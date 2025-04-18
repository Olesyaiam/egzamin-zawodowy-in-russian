<?php

/** @var \Laravel\Lumen\Routing\Router $router */

$router->get('/', function () use ($router) {
    return redirect()->to('https://github.com/Olesyaiam/egzamin-zawodowy-in-russian/');
});

$router->post('translations/get', 'TranslationsController@getTranslation');
$router->post('translations/markCorrect', 'TranslationsController@markCorrect');
$router->post('translations/markIncorrect', 'TranslationsController@markIncorrect');
$router->get('translations/stats', 'TranslationsController@getTranslationStats');
$router->post('menu/menu', 'MenuController@menu');
