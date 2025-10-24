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
        return $this->response(array(
            'items' => array(
                [
                    'text' => mb_strtoupper('Поставьте нам звезду на GitHub'),
                    'url' => 'https://github.com/Olesyaiam/egzamin-zawodowy-in-russian#readme',
                    'icon' => 'icon-retweet',
                    'style' => 'color: red;'
                ],
                [
                    'text' => mb_strtoupper('Водительские права в Польше на русском'),
                    'url' => 'https://github.com/pohape/polish-driving-exam-tests-prep-in-russian#readme',
                    'icon' => 'icon-star',
                    'style' => 'color: red;'
                ]
            ),
            'remove' => array(
                'mailto:kontakt@egzaminzawodowy.info',
                'https://www.testy.egzaminzawodowy.info/wspolpraca.php',
                'https://www.testy.egzaminzawodowy.info/nauka-zdalna.php',
                'https://forum.egzaminzawodowy.info/'
            )
        ));
    }
}
