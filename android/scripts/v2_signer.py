import hashlib
import struct
import subprocess

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

def length_prefixed(data):
    return struct.pack('<I', len(data)) + data

def sign_v2(apk_bytes, cert_der_bytes, key_pem_path):
    eocd_pos = apk_bytes.rfind(b'\x50\x4b\x05\x06')
    if eocd_pos == -1:
        raise ValueError("EOCD not found")
        
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

if __name__ == '__main__':
    with open('app/build/outputs/apk/debug/app-debug.apk', 'rb') as f:
        apk = f.read()
    with open('/tmp/debug.der', 'rb') as f:
        cert = f.read()
    signed = sign_v2(apk, cert, '/tmp/debug.key')
    print('Signed APK length:', len(signed))
    with open('/tmp/v2_signed.apk', 'wb') as f:
        f.write(signed)
    print('Success writing /tmp/v2_signed.apk')
