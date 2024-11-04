<?php

namespace App\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class MenuController extends BaseController
{
    /**
     * @param Request $request
     * @return JsonResponse
     */
    public function menu(Request $request): JsonResponse
    {
        return $this->response([
            'items' => [
                // [
                //     'text' => mb_strtoupper('Попробуйте такое же расширение для решения польских тестов ПДД на русском'),
                //     'url' => 'https://chromewebstore.google.com/detail/gegcmhooaioaleibmojcgihkiepnobij',
                //     'icon' => 'icon-info-sign',
                //     'style' => 'color: red; font-size: 20px'
                // ],
                [
                    'text' => mb_strtoupper('Поставьте нам звезду на GitHub'),
                    'url' => 'https://github.com/Olesyaiam/egzamin-zawodowy-in-russian',
                    'icon' => 'icon-retweet',
                    'style' => 'color: green;'
                ]
            ]
        ]);
    }
}
