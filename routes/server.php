
<?php

use Illuminate\Support\Facades\Route;
use MrpackManager\Http\Controllers\InspectPackController;
use MrpackManager\Http\Controllers\InstallPackController;

Route::post('/inspect', [InspectPackController::class, 'inspect'])
    ->name('inspect');

Route::get('/launcher', [InstallPackController::class, 'launcher'])
    ->name('launcher');

Route::post('/activate', [InstallPackController::class, 'activate'])
    ->name('activate');
