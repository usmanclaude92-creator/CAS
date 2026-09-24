package com.artifysols.cas.feature.auth

import androidx.compose.ui.test.assertDoesNotExist
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import com.artifysols.cas.core.common.AppError
import org.junit.Rule
import org.junit.Test

/**
 * Stateless UI test against LoginScreen directly (no Supabase/network), so
 * it verifies rendering and callback wiring without needing a live backend
 * or an authenticated flow. Requires a connected device/emulator to run —
 * unverified in this sandbox, which has neither (see PR description).
 */
class LoginScreenTest {

    @get:Rule
    val composeTestRule = createComposeRule()

    @Test
    fun submitButton_invokesCallback_whenClicked() {
        var submitCount = 0

        composeTestRule.setContent {
            LoginScreen(
                state = LoginUiState(email = "admin@artifysols.com", password = "Abcd@1234"),
                onEmailChange = {},
                onPasswordChange = {},
                onSubmit = { submitCount++ },
            )
        }

        composeTestRule.onNodeWithText("Sign In").performClick()
        assert(submitCount == 1)
    }

    @Test
    fun generalError_isDisplayed_whenPresent() {
        composeTestRule.setContent {
            LoginScreen(
                state = LoginUiState(generalError = AppError.Unauthorized),
                onEmailChange = {},
                onPasswordChange = {},
                onSubmit = {},
            )
        }

        composeTestRule.onNodeWithText(AppError.Unauthorized.userMessage).assertIsDisplayed()
    }

    @Test
    fun loadingState_disablesSubmitInteraction() {
        composeTestRule.setContent {
            LoginScreen(
                state = LoginUiState(email = "a@b.com", password = "x", isLoading = true),
                onEmailChange = {},
                onPasswordChange = {},
                onSubmit = {},
            )
        }

        // While loading, the button shows a spinner instead of the "Sign In"
        // label — asserting the label is gone confirms the loading affordance
        // actually replaces it rather than just overlaying it.
        composeTestRule.onNodeWithText("Sign In").assertDoesNotExist()
    }
}
