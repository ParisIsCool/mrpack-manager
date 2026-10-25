<?php

use Illuminate\Support\Facades\Route;
use MrpackManager\Http\Controllers\StatusController;

// Final URL: GET /api/client/extensions/mrpack-manager/status
Route::get('/status', StatusController::class)->name('status');
