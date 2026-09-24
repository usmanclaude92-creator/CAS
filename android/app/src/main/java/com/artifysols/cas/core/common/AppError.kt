package com.artifysols.cas.core.common

/**
 * A consistent, user-facing error model (spec: never show a raw stack trace
 * or technical exception message to the user). Data sources map whatever
 * they throw (network exceptions, HTTP status codes, Postgrest/Auth
 * exceptions) into one of these; screens render [userMessage].
 */
sealed class AppError(val userMessage: String) {
    data object NoConnection : AppError(
        "No internet connection. Check your network and try again."
    )
    data object Timeout : AppError(
        "The request timed out. Please try again."
    )
    data object Unauthorized : AppError(
        "Your session has expired. Please sign in again."
    )
    data object Forbidden : AppError(
        "You don't have permission to do that."
    )
    data object NotFound : AppError(
        "We couldn't find what you were looking for."
    )
    data class Validation(val field: String?, val reason: String) : AppError(reason)
    data object Conflict : AppError(
        "That change conflicts with existing data. Please refresh and try again."
    )
    data object RateLimited : AppError(
        "Too many attempts. Please wait a moment and try again."
    )
    data object ServerError : AppError(
        "Something went wrong on our end. Please try again shortly."
    )
    data class Unknown(val debugMessage: String?) : AppError(
        "Something unexpected happened. Please try again."
    )
}
