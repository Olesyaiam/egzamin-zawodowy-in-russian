<?php

namespace App\Http\Controllers;

use App\Translator;
use Exception;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class TranslationsController extends BaseController
{
    protected const IMAGES_BASE_URL = 'https://raw.githubusercontent.com/Olesyaiam/egzamin-zawodowy-in-russian/main/server/public/images/flowers/';

    private static function prepareText(string $text)
    {
        if (preg_match('/^([0-9A-F]\.\s)(.*)$/', $text, $matches)) {
            $prefix = $matches[1];
            $text = trim($matches[2]);
        } else {
            $prefix = '';
            $text = trim($text);
        }

        return ['text' => $text, 'prefix' => $prefix];
    }

    /**
     * @param Request $request
     * @return JsonResponse
     * @throws Exception
     */
    public function getTranslation(Request $request)
    {
        $text = $request->input('text', null);

        if (!$text) {
            throw new Exception('Specify "text"');
        }

        $questionContext = $request->input('question_context', '');
        $translator = new Translator();
        $prepared = self::prepareText($text);
        $result = $translator->performTranslation($prepared['text'], questionContext: $questionContext);

        if ($result['translation']) {
            $result['translation'] = $prepared['prefix'] . $result['translation'];
        }

        $started = microtime(true);
        $result['images'] = self::findCorrespondingFlowerImages($prepared);
        $result['images_time'] = round(microtime(true) - $started, 2);

        return $this->response($result);
    }

    private static function findCorrespondingFlowerImages($polishText)
    {
        $results = array();
        $flowerDatabase = json_decode(file_get_contents(__DIR__ . '/../../../storage/flowers.json'), true);

        foreach ($flowerDatabase as $flowerInfo) {
            if (array_key_exists('our_img', $flowerInfo) && $flowerInfo['our_img']) {
                $words = array_key_exists('pl_more', $flowerInfo) ? $flowerInfo['pl_more'] : array();
                $words[] = $flowerInfo['pl'];

                foreach ($words as $word) {
                    if (stripos($polishText, $word) !== false) {
                        $results[$word] = self::IMAGES_BASE_URL . $flowerInfo['our_img'];
                    }
                }
            }
        }

        return $results;
    }

    /**
     * @param Request $request
     * @param string $method
     * @return JsonResponse
     * @throws Exception
     */
    private function mark(Request $request, string $method = 'markCorrect')
    {
        $text = $request->input('text', null);

        if (!$text) {
            throw new Exception('Specify "text"');
        }

        $prepared = self::prepareText($text);

        return $this->response(['error' => (new Translator())->$method($prepared['text']) ? null : self::ERROR]);
    }

    /**
     * @param Request $request
     * @return JsonResponse
     * @throws Exception
     */
    public function markCorrect(Request $request)
    {
        return $this->mark($request, 'markCorrect');
    }

    /**
     * @param Request $request
     * @return JsonResponse
     * @throws Exception
     */
    public function markIncorrect(Request $request)
    {
        return $this->mark($request, 'markIncorrect');
    }
}
