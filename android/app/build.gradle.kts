plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.kotlin.android)
}

android {
    namespace = "com.artifysols.cas"
    compileSdk = 35

    defaultConfig {
        applicationId = "com.artifysols.cas"
        minSdk = 24
        targetSdk = 35
        versionCode = 1
        versionName = "1.0"

        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
    }

    signingConfigs {
        create("release") {
            val keystorePath = System.getenv("CAS_RELEASE_KEYSTORE") ?: project.findProperty("CAS_RELEASE_KEYSTORE") as String?
            if (!keystorePath.isNullOrBlank()) {
                storeFile = file(keystorePath)
                storePassword = System.getenv("CAS_RELEASE_STORE_PASSWORD") ?: project.findProperty("CAS_RELEASE_STORE_PASSWORD") as String?
                keyAlias = System.getenv("CAS_RELEASE_KEY_ALIAS") ?: project.findProperty("CAS_RELEASE_KEY_ALIAS") as String?
                keyPassword = System.getenv("CAS_RELEASE_KEY_PASSWORD") ?: project.findProperty("CAS_RELEASE_KEY_PASSWORD") as String?
            }
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = true
            isShrinkResources = true
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
            // Only applied when CAS_RELEASE_KEYSTORE is actually configured (see
            // signingConfigs above and README-release-signing.md) — otherwise
            // Gradle falls back to no signing config and the build fails loudly
            // rather than silently reusing a debug/self-signed certificate.
            val keystorePath = System.getenv("CAS_RELEASE_KEYSTORE") ?: project.findProperty("CAS_RELEASE_KEYSTORE") as String?
            if (!keystorePath.isNullOrBlank()) {
                signingConfig = signingConfigs.getByName("release")
            }
        }
        debug {
            isMinifyEnabled = false
            isDebuggable = true
        }
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_11
        targetCompatibility = JavaVersion.VERSION_11
    }
    kotlinOptions {
        jvmTarget = "11"
    }
}

dependencies {
    implementation(libs.androidx.core.ktx)
    implementation(libs.androidx.lifecycle.runtime.ktx)
    implementation(libs.androidx.activity.ktx)
    implementation(libs.androidx.core.splashscreen)
    implementation(libs.androidx.webkit)
}
