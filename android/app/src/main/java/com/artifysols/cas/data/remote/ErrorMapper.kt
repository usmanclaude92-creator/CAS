package com.artifysols.cas.data.remote

import com.artifysols.cas.core.common.AppError
import io.github.jan.supabase.auth.exception.AuthRestException
import io.github.jan.supabase.exceptions.BadRequestRestException
import io.github.jan.supabase.exceptions.HttpRequestException
import io.github.jan.supabase.exceptions.NotFoundRestException
import io.github.jan.supabase.exceptions.RestException
import io.github.jan.supabase.exceptions.UnauthorizedRestException
import io.github.jan.supabase.exceptions.UnknownRestException
import kotlinx.coroutines.TimeoutCancellationException
import java.io.IOException

/**
 * Every data-source call goes through this so no raw exception message or
 * stack trace ever reaches a screen (spec §21) — network/HTTP/Postgrest/Auth
 * exceptions all collapse into the same small [AppError] vocabulary the UI
 * already knows how to render.
 */
fun Throwable.toAppError(): AppError = when (this) {
    is AuthRestException -> when (statusCode.value) {
        400, 422 -> AppError.Validation(null, message ?: "Invalid email or password.")
        401 -> AppError.Unauthorized
        403 -> AppError.Forbidden
        429 -> AppError.RateLimited
        in 500..599 -> AppError.ServerError
        else -> AppError.Unknown(message)
    }
    is UnauthorizedRestException -> AppError.Unauthorized
    is NotFoundRestException -> AppError.NotFound
    is BadRequestRestException -> AppError.Validation(null, message ?: "That request was invalid.")
    is RestException -> when (statusCode) {
        409 -> AppError.Conflict
        429 -> AppError.RateLimited
        in 500..599 -> AppError.ServerError
        else -> AppError.Unknown(message)
    }
    is UnknownRestException -> AppError.Unknown(message)
    is TimeoutCancellationException -> AppError.Timeout
    is HttpRequestException, is IOException -> AppError.NoConnection
    else -> AppError.Unknown(message)
}
