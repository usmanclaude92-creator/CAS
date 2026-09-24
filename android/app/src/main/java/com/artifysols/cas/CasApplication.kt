package com.artifysols.cas

import android.app.Application
import com.artifysols.cas.core.di.AppContainer

class CasApplication : Application() {
    lateinit var container: AppContainer
        private set

    override fun onCreate() {
        super.onCreate()
        container = AppContainer(this)
    }
}
