<?php

namespace App;

use Exception;

class Translator extends Base
{
    const OPEN_AI_API_KEY_FILE = '../config/open_ai_api_key.txt';
    const CHAT_GPT_PROMPT_FILE = '../config/chat_gpt_prompt.json';
    protected string $filename = 'translations.json';

    const INCORRECT = 'INCORRECT';
    const NOT_APPROVED = 'NOT_APPROVED';
    const CORRECT = 'CORRECT';

    /**
     * @param $systemMessage
     * @param $userData
     * @return array
     * @throws Exception
     */
    private static function requestOpenAI($systemMessage, $userData)
    {
        $path = __DIR__ . '/' . self::OPEN_AI_API_KEY_FILE;

        if (!is_file($path)) {
            throw new Exception('The file with the API key not found: ' . self::OPEN_AI_API_KEY_FILE);
        }

        $lines = file($path, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
        $prompt = 'Фрагмент для перевода: "' . $userData . '"';
        $data = [
            'model' => 'gpt-4o',
            'max_tokens' => 300,
            'messages' => [
                ['role' => 'system', 'content' => $systemMessage],
                ['role' => 'user', 'content' => $prompt]
            ]
        ];

        $headers = [
            'Content-Type: application/json',
            'Authorization: Bearer ' . trim($lines[array_rand($lines)])
        ];

        $ch = curl_init('https://api.openai.com/v1/chat/completions');
        curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($data));

        $response = curl_exec($ch);

        if (curl_errno($ch)) {
            throw new Exception(curl_error($ch));
        }

        $decodedResponse = json_decode($response, true);
        curl_close($ch);

        $translation = $decodedResponse['choices'][0]['message']['content'] ?? null;

        return array(
            'error' => $decodedResponse['error']['message'] ?? null,
            'approved' => false,
            'info' => empty($decodedResponse['error']['message'])
                ? [$decodedResponse['model'], $decodedResponse['usage']]
                : null,
            'prompt' => [$systemMessage, $prompt],
            'translation' => $translation,
        );
    }

    private function findOriginalByTranslation(string $translation)
    {
        $translations = $this->load();
        $original = array_search($translation, $translations['not_approved']);

        if ($original) {
            return [$original, false];
        }

        return null;
    }

    /**
     * @param string $translation
     * @param string $type
     * @return bool
     * @throws Exception
     */
    private function mark(string $translation, string $type)
    {
        $original = $this->findOriginalByTranslation($translation);

        if (!$original) {
            throw new Exception(sprintf(
                'The original string of the translation "%s" was not found. Could it have already been processed?',
                $translation
            ));
        }

        $this->saveToTranslations($original[0], $translation, $type);

        return true;
    }

    /**
     * @param string $translation
     * @return bool
     * @throws Exception
     */
    public function markCorrect(string $translation)
    {
        return $this->mark($translation, self::CORRECT);
    }

    /**
     * @param string $translation
     * @return bool
     * @throws Exception
     */
    public function markIncorrect(string $translation)
    {
        return $this->mark($translation, self::INCORRECT);
    }

    private function saveToTranslations(string $original, string $translation, string $type)
    {
        $path = $this->storagePath . '/' . $this->filename;

        // Открываем файл для чтения и записи
        $file = fopen($path, 'c+');

        if (!$file) {
            throw new Exception("Не удалось открыть файл: $path");
        }

        // Ожидаем снятия блокировки
        $locked = false;

        for ($i = 0; $i < 20; $i++) {
            if (flock($file, LOCK_EX | LOCK_NB)) { // Пытаемся установить блокировку без ожидания (LOCK_NB)
                $locked = true;
                break;
            }

            usleep(100000); // Задержка перед повторной попыткой 0.1 секунды
        }

        if (!$locked) {
            fclose($file);
            throw new Exception("Не удалось установить блокировку для файла: $path после {$maxRetries} попыток.");
        }

        $translations = json_decode(file_get_contents($path), true) ?: [];

        unset($translations['not_approved'][$original]);
        unset($translations['incorrect'][$original]);

        if ($type == self::CORRECT) {
            $translations['approved']['others'][$original] = $translation;
        } elseif ($type == self::INCORRECT) {
            $translations['incorrect'][$original] = $translation;
        } else {
            $translations['not_approved'][$original] = $translation;
        }

        // Перематываем файл в начало, очищаем его и записываем новые данные
        ftruncate($file, 0);
        rewind($file);
        fwrite($file, json_encode($translations, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));

        // Снимаем блокировку и закрываем файл
        flock($file, LOCK_UN);
        fclose($file);
    }

    private static function replaceRoadSignCyrillicCodes($text)
    {
        $replacement = function ($matches) {
            return strtr(
                $matches[0],
                [
                    'А' => 'A',
                    'В' => 'B',
                    'С' => 'C',
                    'Е' => 'E',
                    'Н' => 'H',
                    'Р' => 'P',
                    'Т' => 'T',
                    'а' => 'a',
                    'в' => 'b',
                    'с' => 'c',
                    'е' => 'e',
                    'н' => 'h',
                    'р' => 'p',
                    'т' => 't',
                ]
            );
        };

        return preg_replace_callback('/\b([А-ЯA-Z]-\d+[A-Za-zА-Яа-я]?)/u', $replacement, $text);
    }

    private static function generateDictionary(array $promptData, string $text, array $flowerTranslations)
    {
        $dictionary = [];
        $searchAndUpdate = function ($searchWord, $phrase) use (&$dictionary, $text) {
            if (stripos($text, $searchWord) !== false) {
                $dictionary[$phrase] = null;
            }
        };

        foreach ($promptData['dictionary_by_phrase'] as $phrase => $searchList) {
            foreach ($searchList as $searchWord) {
                $searchAndUpdate($searchWord, $phrase);
            }
        }

        foreach ($promptData['dictionary_by_search_word'] as $searchWord => $phrases) {
            foreach ($phrases as $phrase) {
                $searchAndUpdate($searchWord, $phrase);
            }
        }

        foreach ($promptData['dictionary_others'] as $searchWord => $phrase) {
            $searchAndUpdate($searchWord, $phrase);
        }

        foreach ($flowerTranslations as $key => $value) {
            $dictionary["$key: $value"] = null;
        }

        return array_keys($dictionary);
    }

    private static function generatePrompt($text, $questionContext, $flowerTranslations)
    {
        $promptData = json_decode(file_get_contents(__DIR__ . '/' . self::CHAT_GPT_PROMPT_FILE), true);
        $comments = [];
        $dictionary = self::generateDictionary($promptData, $text, $flowerTranslations);
        $dictionaryIntro = count($dictionary) ? $promptData['dictionary_intro'] : '';
        $questionContext = strlen($questionContext) > 0
            ? 'Фрагмент является одним за вариантов ответа на вопрос из теста, вот он для контекста: "' . $questionContext . '." '
            : '';

        foreach ($promptData['comments'] as $line => $searchList) {
            foreach ($searchList as $search) {
                if (stripos($text, $search) !== false) {
                    $comments[$line] = null;
                }
            }
        }

        $prompt = str_ireplace('%question_context%', $questionContext, $promptData['prompt']);
        $prompt = str_ireplace('%comments%', trim(join(' ', array_keys($comments))), $prompt);
        $prompt = str_ireplace('%dictionary_intro%', $dictionaryIntro . PHP_EOL, $prompt);
        $prompt = str_ireplace('%dictionary%', trim(join(PHP_EOL, $dictionary)), $prompt);
        $prompt = str_ireplace(
            '%short_notice%',
            strlen($text) < 30 ? $promptData['short_notice'] : '',
            $prompt
        );

        return trim($prompt);
    }

    private function findInTranslations($original)
    {
        $original = trim(trim(trim($original), '.'));
        $translations = $this->load();

        foreach ($translations['approved'] as $category) {
            if (array_key_exists($original, $category)) {
                return [$category[$original], true];
            }
        }

        if (array_key_exists($original, $translations['not_approved'])) {
            return [$translations['not_approved'][$original], false];
        }

        return null;
    }

    private static function trimDoubleQuotes(string $string)
    {
        $string = str_ireplace('\"', '"', $string);
        $string = trim($string);

        if (substr($string, 0, 1) === '"' && substr($string, -1) === '"') {
            return substr($string, 1, -1);
        }

        return $string;
    }

    /**
     * @param $original
     * @param bool $withCache
     * @return array
     * @throws Exception
     */
    public function performTranslation($original, $questionContext, $flowerTranslations, $withCache = true)
    {
        $original = preg_replace('/([A-Z])\s*-\s*(\d+[a-z]?)/', '$1-$2', $original);
        $original = trim(preg_replace('/\s+/', ' ', $original));

        if (strlen($original) <= 3) {
            $result = array(
                'translation' => $original,
                'approved' => true,
                'info' => 'A short string: only ' . strlen($original) . ' symbol(s)',
                'error' => null
            );
        } elseif (is_numeric($original) || preg_match('/^[0-9].{1,9}$/', $original)) {
            $result = array(
                'translation' => $original,
                'approved' => true,
                'info' => 'A number: no need to translate',
                'error' => null
            );
        } elseif (substr($original, -2) === 'cm') {
            $result = array(
                'translation' => $original,
                'approved' => true,
                'info' => 'Centimeters',
                'error' => null
            );
        } else {
            $translation = $withCache ? $this->findInTranslations($original) : null;

            if ($translation === null) {
                $apiResponse = self::requestOpenAI(
                    self::generatePrompt(
                        $original,
                        $questionContext,
                        $flowerTranslations
                    ),
                    $original
                );

                if ($withCache && $apiResponse['translation'] !== null) {
                    $apiResponse['translation'] = self::trimDoubleQuotes(self::replaceRoadSignCyrillicCodes($apiResponse['translation']));
                    $this->saveToTranslations(
                        trim(trim(trim($original), '.')),
                        $apiResponse['translation'],
                        self::NOT_APPROVED
                    );
                }

                $result = $apiResponse;
            } else {
                $result = array(
                    'translation' => $translation[0],
                    'approved' => $translation[1],
                    'error' => null
                );
            }
        }

        if (!empty($result['translation'])) {
            $additional = '';

            if (stripos($original, 'zterokoł')) {
                $additional .= '"czterokołowec" - масса до 400 кг в случае перевозки людей и масса до 550 кг в случае перевозки грузов';

                if (stripos($original, 'lekk')) {
                    $additional .= ', "czterokołowec lekki" - это масса до 350 кг и скорость до 45 км/ч';
                }
            }

            if ($additional) {
                $result['approved'] = true;
                $result['translation'] .= ' (' . $additional . ')';
            }
        }

        return $result;
    }

    public function getStats(): array
    {
        $translations = $this->load();

        $approvedCount = 0;
        foreach ($translations['approved'] ?? [] as $category) {
            $approvedCount += count($category);
        }

        $notApprovedCount = count($translations['not_approved'] ?? []);

        return [
            'approved' => $approvedCount,
            'not_approved' => $notApprovedCount
        ];
    }
}
