# DSH profile "web" — отчёт шага 1 (только чтение, ничего не изменено)

Дата анализа: 2026-09-16. Анализ выполнен read-only: ни один файл профиля не изменён.
Скрипт-доказательство: `_dsh_diag_resolve.mjs` (резолв модулей, ничего не загружает из плагинов).

## 0. Идентификация экземпляра — ДА, это тот самый процесс

| Признак | Значение |
|---|---|
| `$DSH_HOME` | `C:\Users\VoilT\.dsh` |
| `$DSH_WEB_URL` | `http://127.0.0.1:3080` (этот GUI) |
| Процесс (PID 13660) | `node ...\_npx\1e7f6d9597241db0\node_modules\@deepseek-ai\dsh\lib\bin.js web` |
| Версия CLI | `@deepseek-ai/dsh` **0.1.5-rc.1** |
| Платформенные пакеты | **0.1.5-rc.2** (в npx-кэше) |
| Профиль | `C:\Users\VoilT\.dsh\profiles\web` |

Вывод: я работаю внутри диагностируемого экземпляра. Поэтому **сам ничего не меняю** —
только готовлю apply/rollback для запуска вами во внешнем терминале.

## 1. Дубли записей в cordis.patch.yml — ПОДТВЕРЖДЕНО

Файл: `C:\Users\VoilT\.dsh\profiles\web\cordis.patch.yml`
Состояние на момент анализа: `size=1371`, `mtime=2026-09-16T17:14:46.8447875+03:00`, `sha256=77FEEE06C8F1B7B607BCE8872289543FC0B10CB94BE316ED49F9851B859079F5`

> ⚠️ Файл правился **во время сессии**: первое чтение дало 1418 байт / 52 строки,
> затем 1371 байт / 50 строк (кто-то/что-то в GUI удалило пару записей).
> Поэтому apply обязан делать снимок и сверять хеш.

Дубли (один и тот же id несколько раз):

| id | Вхождения | Эффективное значение (last-wins) |
|---|---|---|
| `ui-skins` | строки 5 (`false`), 35 (`true`) | **disabled: true** |
| `dsh-voice` | строки 19 (`false`), 39 (`true`) | **disabled: true** |
| `open-sea-skin` | строки 23 (`false`), 25 (`true`), 42 (`true`) | **disabled: true** |
| `ui-theme-cyberpunk` | строки 31 (`true`), 45 (`true`) | **disabled: true** |

Эффективное состояние всех 10 затронутых id (проверено валидатором
`_dsh_check_yaml.mjs` — js-yaml + повтор семантики загрузчика):

* выключены (9): `ui-skins`, `dsh-voice`, `open-sea-skin`, `ui-theme-cyberpunk`,
  `vision-toolkit`, `dsh-tts`, `talk-map`, `deepseek-balance-widget`, `dsh-whale-widget`
* **включён (1): `dsh-messenger-gateway`** (`disabled: false` + config).
  Его `disabled: true` (строки 37–39 в первой редакции файла) был удалён правкой в GUI,
  поэтому сейчас он фактически включён. Это важно: «последний побеждает» здесь даёт `false`.

## 2. Семантика загрузчика — дубли НЕ вызывают падения

Код: `@deepseek-ai/dsh-app-boot\lib\index.js`

- `composeEntries()` → `applyEntryPatches([], patches)` (строка 904)
- `applyEntryPatches()` (строка 59): патчи применяются **по порядку**, каждый мутирует
  уже найденную запись: `target[key] = value` (строка 104) → **побеждает последний**.
- Несуществующий id: `warn("patch: entry %C not found", id)` + `continue` (строки 94–97) —
  **предупреждение, не исключение**.

Порядок слоёв (`composeProfile`): bundle-патчи → `cordis.patch.yml` → `$DSH_HOME/cordis.patch.yml`
(отсутствует) → `--patch`. Внутри профиля: последняя запись с данным id побеждает.

**Следствие:** дубли — это структурная грязь и источник путаницы, но не краш.
`dsh-fix` дописывал `disabled: true` в конец, поэтому фактически выключены:
`ui-skins`, `dsh-voice`, `open-sea-skin`, `ui-theme-cyberpunk`, `dsh-messenger-gateway`,
`vision-toolkit`, `dsh-tts`, `talk-map`, `deepseek-balance-widget`.

## 3. Расхождения зависимостей — ПОДТВЕРЖДЕНЫ, но это тени (shadowing), а не краши

### 3.1 `@deepseek-ai/dsh-credentials` (3 плагина)

- `@anionex/dsh-vision-toolkit@0.1.40`, `@goodandready/dsh-tts@0.3.21`,
  `@goodandready/dsh-voice@0.8.14` — все объявляют peer `@deepseek-ai/dsh-credentials: ^0.1.0-rc.6`
- Профиль содержит локальную копию **0.0.1-rc.1** → `pnpm-lock.yaml:132`, `:2265`
- Причина: в `pnpm-workspace.yaml` стоит `autoInstallPeers: false`, а спецификатор в лок-файле — `'*'`.
  У этих пакетов `dist-tags.latest` = **0.0.1-rc.1** (проверено в реестре npm), поэтому `'*'`
  разрешился в самую старую версию, а не в актуальную линию.
- Доказательство затенения (`_dsh_diag_resolve.mjs`):

```
from ...\profiles\web\node_modules\@goodandready\dsh-tts\lib\index.js
  -> ...\profiles\web\node_modules\@deepseek-ai\dsh-credentials\lib\index.js   = 0.0.1-rc.1  [PROFILE-LOCAL]

from ...\_npx\...\@deepseek-ai\dsh-base\lib\index.js
  -> ...\_npx\...\@deepseek-ai\dsh-credentials\lib\index.js                    = 0.1.5-rc.2  [dsh install]
```

- Официальная платформа **не затронута**: её пакеты резолвят 0.1.5-rc.2 корректно.
- API-совместимость: 0.0.1-rc.1 экспортирует `{ Credentials, default, credentialRef }`;
  0.1.5-rc.2 — надмножество `{ CredentialProvider, default, credentialKey, credentialKeyId,
  credentialKeyScope, credentialRef, isCredentialKeySegment, isCredentialRefName, parseCredentialKey }`.
  TTS и Voice импортируют только `credentialRef` → **импорт не падает**, функциональной поломки нет.
- Плюс: `dsh-tts` и `dsh-voice` сейчас **выключены** патчем.

### 3.2 `dsh-client-ui-skins` → `dsh-client-runtime` / `dsh-client-ui-slots`

- `dsh-client-ui-skins@0.1.16` (github:caoyiwei850) требует `>=0.1.0-rc.8`
- Фактически резолвится **0.1.0-rc.7**, причём **не из профиля**, а из отдельного dev-чекаута:
  `C:\Users\VoilT\deepseek-harness\packages\client\runtime\lib\client.js` → `[dsh installation]`
- `@deepseek-ai/dsh-client-store` — **отсутствует везде** (проверено: профиль, npx-кэш, `profiles\node_modules`).
- Код плагина (`lib\client.js:20-34`) рассчитан на обе генерации через try/catch:
  `dsh-client-runtime/client` (DSH ≤ 0.1.1) ИЛИ `dsh-client-store` (alpha).
  Первый резолвится → плагин грузится. В реестре npm `0.1.0-rc.8` **действительно существует**.
- Плагин `ui-skins` выключен патчем.
- Вывод: это предупреждение о диапазоне, подтверждённой поломки нет. Обновление до rc.8+
  потребовало бы менять/подменять клиентскую платформу — выходит за рамки «только явные ошибки».

### 3.3 Осиротевшие id (следствие «entry not found» → только warn)

- `ui-theme-cyberpunk` — не установлен в профиле, в bundles отсутствует → патч не применяется
- `dsh-whale-widget` — **не установлен и не в bundles** (есть на npm как `dsh-whale-widget@0.3.2`)
- `deepseek-balance-widget` — установлен пакет `dsh-deepseek-balance-widget@2.4.2`;
  совпадение id не подтверждено (id записи в дереве cordis, а не в manifest) — требует проверки дампом

## 4. Итоговая оценка

| Пункт | Статус | Краш? |
|---|---|---|
| Дубли записей в patch | подтверждено | нет |
| `dsh-credentials` 0.0.1-rc.1 вместо ≥0.1.0-rc.6 | подтверждено | нет (совместимый API, плагины выключены) |
| `dsh-client-runtime`/`ui-slots` rc.7 вместо ≥rc.8 | подтверждено | нет (try/catch + плагин выключен) |
| Падения при запуске | **не обнаружено** | — |

Ни одного подтверждённого краша найти не удалось: загрузчик разрешает дубли по принципу
«последний побеждает», несуществующие id пропускает с предупреждением, а нужные плагинам
API присутствуют в фактически резолвящихся версиях.

Живое подтверждение работоспособности: этот экземпляр работает — веб-GUI на 127.0.0.1:3080,
инструменты (включая image-gen, `present`, `job_*`) зарегистрированы.

## 5. Предлагаемые изменения (ожидают подтверждения)

A. **cordis.patch.yml**: свернуть 4 дублированных id до одной записи, сохранив текущее
   эффективное состояние (`disabled: true`), убрать мёртвые комментарии `dsh-fix`.
B. **Опционально**: снять затенение `dsh-credentials` (добавить явную зависимость
   `@deepseek-ai/dsh-credentials@0.1.5-rc.2` и обновить только этот пакет) — уберёт 3 из 5
   пунктов диагностики. Официальные бандлы не затрагиваются.
C. **Не трогать**: `dsh-client-runtime`/`ui-slots` rc.7→rc.8 (платформенное расхождение,
   выходит за рамки «только явные ошибки»), осиротевшие id `dsh-whale-widget`,
   `ui-theme-cyberpunk` (только warn).
