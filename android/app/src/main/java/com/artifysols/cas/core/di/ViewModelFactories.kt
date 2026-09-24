package com.artifysols.cas.core.di

import androidx.lifecycle.viewmodel.initializer
import androidx.lifecycle.viewmodel.viewModelFactory
import com.artifysols.cas.feature.auth.LoginViewModel
import com.artifysols.cas.feature.customers.CustomerDetailViewModel
import com.artifysols.cas.feature.customers.CustomersListViewModel
import com.artifysols.cas.feature.dashboard.DashboardViewModel

// One factory function per ViewModel, each wiring the use cases it needs
// from the container. Kept next to AppContainer rather than scattered across
// feature packages so the whole dependency graph reads in two files.

fun loginViewModelFactory(container: AppContainer) = viewModelFactory {
    initializer { LoginViewModel(container.loginUseCase) }
}

fun dashboardViewModelFactory(container: AppContainer) = viewModelFactory {
    initializer {
        DashboardViewModel(
            getDashboardSummaryUseCase = container.getDashboardSummaryUseCase,
            getCurrentUserUseCase = container.getCurrentUserUseCase,
            logoutUseCase = container.logoutUseCase,
        )
    }
}

fun customersListViewModelFactory(container: AppContainer) = viewModelFactory {
    initializer { CustomersListViewModel(container.getCustomerSummariesUseCase) }
}

fun customerDetailViewModelFactory(container: AppContainer, customerId: String) = viewModelFactory {
    initializer { CustomerDetailViewModel(customerId, container.getCustomerLedgerUseCase) }
}
