<?php

namespace App\Http\Controllers;

use App\DatabaseManager;
use App\Translator;
use Exception;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class TranslationsController extends BaseController
{
    protected const TOO_LONG_TEXT = 'The input text is too long';

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
        $started = microtime(true);
        $text = $request->input('text', null);

        if (!$text) {
            throw new Exception('Specify "text"');
        }

        $questionContext = $request->input('question_context', '');
        $translator = new Translator();
        $prepared = self::prepareText($text);

        if (mb_strlen($prepared['text']) > 1000) {
            return $this->response(['error' => self::TOO_LONG_TEXT]);
        }

        $databaseManager = new DatabaseManager();
        $flowers = $databaseManager->findFlowers($prepared['text']);
        $flowerTranslations = array_filter(array_combine(
            array_column($flowers['flowers'], 'pl'),
            array_column($flowers['flowers'], 'ru')
        ));

        $result = $translator->performTranslation(
            $prepared['text'],
            $questionContext,
            $flowerTranslations
        );

        if ($result['translation']) {
            $result['translation'] = $prepared['prefix'] . $result['translation'];
        }

        $result['flowers'] = $flowers['flowers'];
        $result['time'] = array(
            'full' => round(microtime(true) - $started, 2),
            'images_time_file' => $flowers['time_file'],
            'images_time_search' => $flowers['time_search']
        );

        return $this->response($result);
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

    public function getTranslationStats(Request $request): JsonResponse
    {
        $repoPath = '/home/user/GitHub/egzamin-zawodowy-in-russian'; // корень, где .git реально есть
        $cmd = 'cd ' . escapeshellarg($repoPath) . ' && /usr/bin/git log -1 --format=%ct 2>&1';
        $output = shell_exec($cmd);
        return response()->json(['cmd' => $cmd, 'output' => $output, 'user' => shell_exec('whoami')]);

//        $translator = new \App\Translator();
//        $stats = $translator->getStats();
//
//        // Получение времени последнего коммита
//        $gitCommand = 'cd ' . __DIR__ . '; /usr/bin/git log -1 --format=%ct';
//        $lastCommitTimestamp = trim(shell_exec($gitCommand));
//        $stats['command'] = $gitCommand;
//        $stats['last_commit'] = $lastCommitTimestamp;

//        if (is_numeric($lastCommitTimestamp)) {
//            $timeSince = time() - (int)$lastCommitTimestamp;
//
//            $stats['last_commit'] = [
//                'timestamp' => (int)$lastCommitTimestamp,
//                'seconds_ago' => $timeSince,
//                'human' => $this->humanTimeDiff($timeSince),
//            ];
//        } else {
//            $stats['last_commit'] = 'Could not determine last commit time';
//        }

        return $this->response($stats);
    }

    // Преобразует секунды в человекочитаемый формат
    private function humanTimeDiff(int $seconds): string
    {
        if ($seconds < 60) {
            return "$seconds секунд назад";
        } elseif ($seconds < 3600) {
            return floor($seconds / 60) . " минут назад";
        } elseif ($seconds < 86400) {
            return floor($seconds / 3600) . " часов назад";
        } else {
            return floor($seconds / 86400) . " дней назад";
        }
    }
}
