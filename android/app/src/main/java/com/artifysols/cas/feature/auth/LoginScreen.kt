package com.artifysols.cas.feature.auth

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import com.artifysols.cas.core.designsystem.components.AppTextField
import com.artifysols.cas.core.designsystem.components.PasswordTextField
import com.artifysols.cas.core.designsystem.components.PrimaryButton
import com.artifysols.cas.core.designsystem.theme.CasSpacing

@Composable
fun LoginRoute(
    viewModel: LoginViewModel,
    onLoginSuccess: () -> Unit,
) {
    val state by viewModel.uiState.collectAsStateWithLifecycle()

    LaunchedEffect(state.loginSucceeded) {
        if (state.loginSucceeded) onLoginSuccess()
    }

    LoginScreen(
        state = state,
        onEmailChange = viewModel::onEmailChange,
        onPasswordChange = viewModel::onPasswordChange,
        onSubmit = viewModel::onSubmit,
    )
}

@Composable
fun LoginScreen(
    state: LoginUiState,
    onEmailChange: (String) -> Unit,
    onPasswordChange: (String) -> Unit,
    onSubmit: () -> Unit,
) {
    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(MaterialTheme.colorScheme.background),
        contentAlignment = Alignment.Center,
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .verticalScroll(rememberScrollState())
                .padding(CasSpacing.xl)
                .imePadding(),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            Spacer(Modifier.height(CasSpacing.xxl))

            Text(
                text = "Artify Construction",
                style = MaterialTheme.typography.headlineSmall,
                fontWeight = FontWeight.Bold,
            )
            Text(
                text = "Accounting System",
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )

            Spacer(Modifier.height(CasSpacing.xxl))

            Text(
                text = "Sign in to your account",
                style = MaterialTheme.typography.titleLarge,
            )
            Spacer(Modifier.height(CasSpacing.xs))
            Text(
                text = "Enter your credentials to access your corporate account",
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )

            Spacer(Modifier.height(CasSpacing.xl))

            AppTextField(
                value = state.email,
                onValueChange = onEmailChange,
                label = "Corporate Email Address",
                required = true,
                errorText = state.emailError,
                keyboardType = KeyboardType.Email,
                enabled = !state.isLoading,
            )

            Spacer(Modifier.height(CasSpacing.md))

            PasswordTextField(
                value = state.password,
                onValueChange = onPasswordChange,
                label = "Password",
                errorText = state.passwordError,
                imeAction = ImeAction.Done,
                onImeAction = onSubmit,
            )

            if (state.generalError != null) {
                Spacer(Modifier.height(CasSpacing.md))
                Text(
                    text = state.generalError.userMessage,
                    color = MaterialTheme.colorScheme.error,
                    style = MaterialTheme.typography.bodyMedium,
                )
            }

            Spacer(Modifier.height(CasSpacing.xl))

            PrimaryButton(
                text = "Sign In",
                onClick = onSubmit,
                isLoading = state.isLoading,
            )

            Spacer(Modifier.height(CasSpacing.xxl))

            Text(
                text = "Artify Construction Accounting System",
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
    }
}
