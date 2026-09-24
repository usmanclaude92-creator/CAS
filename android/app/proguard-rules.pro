# Kotlinx Serialization keeps its own consumer rules via the library AAR;
# these cover the app's own @Serializable model classes, which is the part
# a library's consumer-rules.pro can't know about in advance.
-keepattributes *Annotation*, InnerClasses
-dontnote kotlinx.serialization.AnnotationsKt
-keepclasseswithmembers class com.artifysols.cas.data.remote.** {
    *** Companion;
}
-keepclasseswithmembers class com.artifysols.cas.data.remote.** {
    kotlinx.serialization.KSerializer serializer(...);
}
-keep,includedescriptorclasses class com.artifysols.cas.data.remote.**$$serializer { *; }
-keepclassmembers class com.artifysols.cas.data.remote.** {
    *** Companion;
}
