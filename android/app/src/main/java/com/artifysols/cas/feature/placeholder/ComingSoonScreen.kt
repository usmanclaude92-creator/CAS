package com.artifysols.cas.feature.placeholder

import androidx.compose.runtime.Composable
import com.artifysols.cas.core.designsystem.components.EmptyView

/**
 * Temporary placeholder for CAS web-app modules not yet ported to native
 * (phased rollout, see the PR description) — every drawer item routes
 * somewhere real instead of a dead link, even before its full feature lands.
 */
@Composable
fun ComingSoonScreen(moduleName: String) {
    EmptyView(
        title = moduleName,
        message = "This module is being ported from the web app and will be available in an upcoming update.",
    )
}
