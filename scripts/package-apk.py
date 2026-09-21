#!/usr/bin/env python3
import os
import sys
import zipfile
import subprocess
import tempfile
import struct
import hashlib

def generate_keystore_and_keys():
    key_pem = "/tmp/debug.key"
    cert_pem = "/tmp/debug.crt"
    cert_der = "/tmp/debug.der"
    
    if not os.path.exists(key_pem) or not os.path.exists(cert_pem) or not os.path.exists(cert_der):
        cmd = [
            "openssl", "req", "-x509", "-newkey", "rsa:2048",
            "-keyout", key_pem, "-out", cert_pem,
            "-days", "10000", "-nodes",
            "-subj", "/CN=Android Debug/O=Android/C=US"
        ]
        subprocess.run(cmd, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        
        # Also generate DER format of certificate
        cmd_der = ["openssl", "x509", "-in", cert_pem, "-outform", "DER", "-out", cert_der]
        subprocess.run(cmd_der, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        
    return key_pem, cert_pem, cert_der

def sign_apk_v1(input_apk_path, output_apk_path, key_pem, cert_pem):
    """Signs an APK using Android v1 (JAR) signature scheme."""
    with zipfile.ZipFile(input_apk_path, 'r') as zin:
        entries = [item for item in zin.infolist() if not item.filename.startswith("META-INF/")]
        manifest_lines = [
            "Manifest-Version: 1.0",
            "Created-By: 1.0 (Android)",
            ""
        ]
        entry_digests = {}
        for item in entries:
            data = zin.read(item.filename)
            digest = hashlib.sha256(data).digest()
            import base64
            b64_digest = base64.b64encode(digest).decode('ascii')
            manifest_lines.append(f"Name: {item.filename}")
            manifest_lines.append(f"SHA-256-Digest: {b64_digest}")
            manifest_lines.append("")
            entry_digests[item.filename] = b64_digest

        manifest_content = "\r\n".join(manifest_lines).encode('utf-8')
        manifest_main_digest = hashlib.sha256(manifest_content).digest()
        import base64
        b64_manifest_digest = base64.b64encode(manifest_main_digest).decode('ascii')

        cert_sf_lines = [
            "Signature-Version: 1.0",
            "Created-By: 1.0 (Android)",
            f"SHA-256-Digest-Manifest: {b64_manifest_digest}",
            ""
        ]
        for item in entries:
            name_header = f"Name: {item.filename}\r\nSHA-256-Digest: {entry_digests[item.filename]}\r\n\r\n".encode('utf-8')
            sec_digest = hashlib.sha256(name_header).digest()
            b64_sec_digest = base64.b64encode(sec_digest).decode('ascii')
            cert_sf_lines.append(f"Name: {item.filename}")
            cert_sf_lines.append(f"SHA-256-Digest: {b64_sec_digest}")
            cert_sf_lines.append("")
        cert_sf_content = "\r\n".join(cert_sf_lines).encode('utf-8')

        with tempfile.NamedTemporaryFile("wb", delete=False) as f_sf:
            f_sf.write(cert_sf_content)
            sf_path = f_sf.name

        with tempfile.NamedTemporaryFile("wb", delete=False) as f_rsa:
            rsa_path = f_rsa.name

        cmd = [
            "openssl", "smime", "-sign",
            "-in", sf_path,
            "-out", rsa_path,
            "-outform", "DER",
            "-inkey", key_pem,
            "-signer", cert_pem,
            "-nodetach", "-binary", "-noattr"
        ]
        subprocess.run(cmd, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

        with open(rsa_path, "rb") as f_rsa_in:
            cert_rsa_content = f_rsa_in.read()

        os.unlink(sf_path)
        os.unlink(rsa_path)

        with zipfile.ZipFile(output_apk_path, 'w', compression=zipfile.ZIP_DEFLATED) as zout:
            for item in entries:
                data = zin.read(item.filename)
                # Ensure resources.arsc is stored uncompressed
                if item.filename == "resources.arsc":
                    item.compress_type = zipfile.ZIP_STORED
                zout.writestr(item, data)

            zout.writestr("META-INF/MANIFEST.MF", manifest_content)
            zout.writestr("META-INF/CERT.SF", cert_sf_content)
            zout.writestr("META-INF/CERT.RSA", cert_rsa_content)

def length_prefixed(data):
    return struct.pack('<I', len(data)) + data

def compute_chunk_digests(sections):
    CHUNK_SIZE = 1048576
    chunk_digests = []
    for sec in sections:
        sec_len = len(sec)
        if sec_len == 0:
            continue
        num_chunks = (sec_len + CHUNK_SIZE - 1) // CHUNK_SIZE
        for i in range(num_chunks):
            start = i * CHUNK_SIZE
            chunk = sec[start:start + CHUNK_SIZE]
            h = hashlib.sha256()
            h.update(b'\xa5' + struct.pack('<I', len(chunk)) + chunk)
            chunk_digests.append(h.digest())
            
    all_chunks = b''.join(chunk_digests)
    top_h = hashlib.sha256()
    top_h.update(b'\x5a' + struct.pack('<I', len(chunk_digests)) + all_chunks)
    return top_h.digest()

def sign_apk_v2(apk_bytes, cert_der_bytes, key_pem_path):
    """Applies APK Signature Scheme v2 to apk_bytes."""
    eocd_pos = apk_bytes.rfind(b'\x50\x4b\x05\x06')
    if eocd_pos == -1:
        raise ValueError("EOCD not found in APK")
        
    cd_size = struct.unpack('<I', apk_bytes[eocd_pos+12:eocd_pos+16])[0]
    cd_offset = struct.unpack('<I', apk_bytes[eocd_pos+16:eocd_pos+20])[0]
    
    sec1 = apk_bytes[:cd_offset]
    sec2 = apk_bytes[cd_offset:cd_offset+cd_size]
    
    ALG_SHA256_WITH_RSA = 0x0103
    
    # Extract SubjectPublicKeyInfo DER
    p = subprocess.Popen(['openssl', 'x509', '-inform', 'DER', '-pubkey', '-noout'],
                         stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    pub_pem, _ = p.communicate(cert_der_bytes)
    
    p2 = subprocess.Popen(['openssl', 'rsa', '-pubin', '-outform', 'DER'],
                          stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    pub_der, _ = p2.communicate(pub_pem)
    
    cert_elem = length_prefixed(cert_der_bytes)
    certs_seq = length_prefixed(cert_elem)
    attrs_seq = length_prefixed(b'')
    
    dummy_digest = b'\x00' * 32
    digest_elem = struct.pack('<I', ALG_SHA256_WITH_RSA) + length_prefixed(dummy_digest)
    digests_seq = length_prefixed(digest_elem)
    
    dummy_signed_data = length_prefixed(digests_seq) + length_prefixed(certs_seq) + length_prefixed(attrs_seq)
    dummy_sig = b'\x00' * 256
    sig_elem = struct.pack('<I', ALG_SHA256_WITH_RSA) + length_prefixed(dummy_sig)
    sigs_seq = length_prefixed(sig_elem)
    
    dummy_signer = length_prefixed(dummy_signed_data) + length_prefixed(sigs_seq) + length_prefixed(pub_der)
    dummy_signers_seq = length_prefixed(dummy_signer)
    
    ID_APK_V2 = 0x7109871a
    pair_total_len = 8 + 4 + len(dummy_signers_seq)
    block_len = pair_total_len + 8 + 16
    total_added = 8 + block_len
    
    new_cd_offset = cd_offset + total_added
    modified_eocd = apk_bytes[eocd_pos:eocd_pos+16] + struct.pack('<I', new_cd_offset) + apk_bytes[eocd_pos+20:]
    
    real_digest = compute_chunk_digests([sec1, sec2, modified_eocd])
    
    real_digest_elem = struct.pack('<I', ALG_SHA256_WITH_RSA) + length_prefixed(real_digest)
    real_digests_seq = length_prefixed(real_digest_elem)
    real_signed_data = length_prefixed(real_digests_seq) + length_prefixed(certs_seq) + length_prefixed(attrs_seq)
    
    p_dgst = subprocess.Popen(['openssl', 'dgst', '-sha256', '-binary'],
                              stdin=subprocess.PIPE, stdout=subprocess.PIPE)
    sd_hash, _ = p_dgst.communicate(real_signed_data)
    
    p_sign = subprocess.Popen(['openssl', 'pkeyutl', '-sign', '-inkey', key_pem_path, '-pkeyopt', 'digest:sha256'],
                              stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    real_sig, err = p_sign.communicate(sd_hash)
    if len(real_sig) != 256:
        raise RuntimeError(f"Unexpected signature length {len(real_sig)}: {err}")
        
    real_sig_elem = struct.pack('<I', ALG_SHA256_WITH_RSA) + length_prefixed(real_sig)
    real_sigs_seq = length_prefixed(real_sig_elem)
    real_signer = length_prefixed(real_signed_data) + length_prefixed(real_sigs_seq) + length_prefixed(pub_der)
    real_signers_seq = length_prefixed(real_signer)
    
    v2_pair = struct.pack('<Q', 4 + len(real_signers_seq)) + struct.pack('<I', ID_APK_V2) + real_signers_seq
    magic = b'APK Sig Block 42'
    signing_block = struct.pack('<Q', block_len) + v2_pair + struct.pack('<Q', block_len) + magic
    
    return sec1 + signing_block + sec2 + modified_eocd

def main():
    print("=== Packaging Construction Accounting Android APK ===")
    base_apk = "public/app-debug.apk" if os.path.exists("public/app-debug.apk") else "app/build/outputs/apk/debug/app-debug.apk"
    dist_dir = "dist"
    
    key_pem, cert_pem, cert_der = generate_keystore_and_keys()
    with open(cert_der, "rb") as f:
        cert_der_bytes = f.read()

    tmp_working_apk = "/tmp/app-construction-unsigned.apk"
    tmp_v1_signed = "/tmp/app-construction-v1.apk"

    print("[1/3] Injecting latest web build assets into APK...")
    written_entries = set()
    with zipfile.ZipFile(base_apk, 'r') as zin, zipfile.ZipFile(tmp_working_apk, 'w', compression=zipfile.ZIP_DEFLATED) as zout:
        for item in zin.infolist():
            if item.filename.startswith("META-INF/"):
                continue
            if item.filename.startswith("assets/www/") or item.filename.startswith("assets/assets/"):
                continue
            data = zin.read(item.filename)
            if item.filename == "resources.arsc":
                item.compress_type = zipfile.ZIP_STORED
            zout.writestr(item, data)
            written_entries.add(item.filename)

        if os.path.exists(dist_dir):
            for root, _, files in os.walk(dist_dir):
                for file in files:
                    if file.endswith(".apk"):
                        continue
                    full_path = os.path.join(root, file)
                    rel_path = os.path.relpath(full_path, dist_dir)
                    with open(full_path, "rb") as f:
                        data = f.read()
                        www_entry = f"assets/www/{rel_path}"
                        if www_entry not in written_entries:
                            zout.writestr(www_entry, data)
                            written_entries.add(www_entry)
                        root_asset_entry = f"assets/{rel_path}"
                        if root_asset_entry not in written_entries:
                            zout.writestr(root_asset_entry, data)
                            written_entries.add(root_asset_entry)

    print("[2/3] Signing APK with Android v1 and v2 signature schemes...")
    sign_apk_v1(tmp_working_apk, tmp_v1_signed, key_pem, cert_pem)
    
    with open(tmp_v1_signed, "rb") as f_v1:
        v1_bytes = f_v1.read()
        
    final_apk_bytes = sign_apk_v2(v1_bytes, cert_der_bytes, key_pem)

    print("[3/3] Deploying final dual-signed (v1+v2) APK...")
    os.makedirs("app/build/outputs/apk/debug", exist_ok=True)
    os.makedirs(".build-outputs", exist_ok=True)
    
    with open("app/build/outputs/apk/debug/app-debug.apk", "wb") as f_out:
        f_out.write(final_apk_bytes)
    with open(".build-outputs/app-debug.apk", "wb") as f_out:
        f_out.write(final_apk_bytes)
    os.makedirs("public", exist_ok=True)
    with open("public/app-debug.apk", "wb") as f_out:
        f_out.write(final_apk_bytes)
    if os.path.exists("dist"):
        with open("dist/app-debug.apk", "wb") as f_out:
            f_out.write(final_apk_bytes)

    print(f"Build complete: Construction Accounting dual-signed APK ready ({len(final_apk_bytes):,} bytes).")

if __name__ == "__main__":
    main()
