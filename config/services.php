<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Third Party Services
    |--------------------------------------------------------------------------
    |
    | This file is for storing the credentials for third party services such
    | as Resend, Postmark, AWS, and more. This file provides the de facto
    | location for this type of information, allowing packages to have
    | a conventional file to locate the various service credentials.
    |
    */

    'postmark' => [
        'key' => env('POSTMARK_API_KEY'),
    ],

    'resend' => [
        'key' => env('RESEND_API_KEY'),
    ],

    'ses' => [
        'key' => env('AWS_ACCESS_KEY_ID'),
        'secret' => env('AWS_SECRET_ACCESS_KEY'),
        'region' => env('AWS_DEFAULT_REGION', 'us-east-1'),
    ],

    'slack' => [
        'notifications' => [
            'bot_user_oauth_token' => env('SLACK_BOT_USER_OAUTH_TOKEN'),
            'channel' => env('SLACK_BOT_USER_DEFAULT_CHANNEL'),
        ],
    ],
    'qrisly' => [
        'is_production' => (bool) env('QRISLY_IS_PRODUCTION', false),
        'base_url' => env('QRISLY_BASE_URL', 'https://api-sandbox.collaborator.komerce.id/user'),
        'production_base_url' => env('QRISLY_PRODUCTION_BASE_URL', 'https://api.collaborator.komerce.id/user'),
        'api_key' => env('QRISLY_API_KEY'),
        'merchant_id' => env('QRISLY_MERCHANT_ID'),
    ],

    'wa' => [
        'fonnte_base_url' => env('FONNTE_BASE_URL', 'https://api.fonnte.com'),
        'api_key' => env('WA_API_KEY'),
    ],

];
