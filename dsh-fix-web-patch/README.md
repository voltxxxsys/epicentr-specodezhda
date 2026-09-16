# dsh-fix-web-patch — сворачивание дублей в cordis.patch.yml (профиль DSH "web")

Профиль: `C:\Users\VoilT\.dsh\profiles\web`
Файл-цель: `C:\Users\VoilT\.dsh\profiles\web\cordis.patch.yml`
Состояние, для которого сгенерированы скрипты: `size=1371`, `sha256=77FEEE06C8F1B7B607BCE8872289543FC0B10CB94BE316ED49F9851B859079F5`

## Что делает apply

Убирает дубли записей: `ui-skins`, `dsh-voice`, `open-sea-skin`, `ui-theme-cyberpunk`
встречались по 2–3 раза с противоречивыми `disabled`. Остаётся ровно одна запись на id,
и **эффективное состояние каждого плагина сохраняется** — потому что загрузчик применяет
патчи по порядку («последний побеждает», `@deepseek-ai/dsh-app-boot`, `applyEntryPatches`).

Проверка на копии настоящим YAML-парсером (`js-yaml`) + повтор семантики загрузчика:

| | до | после |
|---|---|---|
| записей в патче | 15 | **10** |
| уникальных id | 10 | 10 |
| дублированных id | 4 | **0** |
| выключено плагинов | 9 | **9** (те же) |
| config у `dsh-messenger-gateway` | есть | **есть** |

Выключены и остаются выключенными: `ui-skins`, `dsh-voice`, `open-sea-skin`,
`ui-theme-cyberpunk`, `vision-toolkit`, `dsh-tts`, `talk-map`,
`deepseek-balance-widget`, `dsh-whale-widget`.
`dsh-messenger-gateway` включён (`disabled: false`) со своим config — как и было.

> Важно: более ранний черновик скрипта выставлял `dsh-messenger-gateway` в `disabled: true`.
> Это было ошибкой: строка `disabled: true` для него была удалена правкой в GUI, поэтому
> фактически он включён. Исправлено и перепроверено.

## Чего apply не касается

* `dsh.profile.bundles` — официальные бандлы не тронуты
* `package.json`, `pnpm-lock.yaml`, `pnpm-workspace.yaml`, `node_modules`
* версии любых зависимостей
* `$DSH_HOME\cordis.patch.yml` (его не существует)
* состав включённых/выключенных плагинов

## Запуск (внешний терминал)

Эта машина: PowerShell **5.1** (`pwsh` отсутствует), поэтому используйте `powershell`
или .bat-обёртки (они сами выбирают интерпретатор).

Сухой прогон — ничего не пишет:

```
cd S:\сайт\dsh-fix-web-patch
powershell -NoProfile -ExecutionPolicy Bypass -File .\apply.ps1 -WhatIf
```

Применение:

```
powershell -NoProfile -ExecutionPolicy Bypass -File .\apply.ps1
```

или `apply.bat`.

Откат:

```
powershell -NoProfile -ExecutionPolicy Bypass -File .\rollback.ps1
```

или `rollback.bat`.

## Идемпотентность и безопасность

apply:
* `-WhatIf` — показать план, ничего не записывать
* снимок создаётся **только если его ещё нет** и **никогда не перезаписывается**;
  если каталог снимка существует — выход с кодом **3** и подсказкой откатиться
* если файл уже равен результату — «already applied», выход **0**, снимок не создаётся
* если структура файла не совпадает с ожидаемой (файл правили вручную/GUI) — отказ, выход **4**,
  ничего не меняется
* запись идёт во временный файл → проверка → перемещение на место; после записи — повторная
  проверка, при расхождении выход **5** с указанием откатиться
* BOM не добавляется (первые байты файла — `23 20 59`, как в оригинале)

rollback:
* нет снимка → сообщение, ничего не делает, выход **0**
* файл уже равен снимку → «already rolled back», выход **0** (повторный откат безопасен)
* файл правили после apply → **отказывается** затирать правки, выход **6** (нужен `-Force`)
* восстановление с проверкой sha256; `-RemoveSnapshot` удаляет снимок после отката

Снимки: `C:\Users\VoilT\.dsh\profiles\web\.dsh-fix-snapshots\2026-09-16-patch-dedupe\`
(`cordis.patch.yml` + `snapshot.json` с исходным sha256/size/mtime).

`dsh` перечитывает `cordis.patch.yml` на лету (`watchUserPatches`) — перезапуск не требуется.

## Проверено (на копии, реальный профиль не изменялся)

| Сценарий | Ожидание | Итог |
|---|---|---|
| `-WhatIf` | файл и снимки не созданы | ✅ |
| apply | 15 → 10 записей, 0 дублей, 9 disabled | ✅ |
| apply повторно | выход 3, «snapshot already exists» | ✅ |
| apply `-Force` | снимок не перезаписан | ✅ |
| rollback | байт-в-байт оригинал (sha256 совпал) | ✅ |
| rollback повторно | выход 0, «already rolled back» | ✅ |
| rollback без снимка | выход 0, ничего не сделано | ✅ |
| правка файла после apply → rollback | выход 6, правки сохранены | ✅ |
| rollback `-Force` | восстановление из снимка | ✅ |
| чужой файл → apply | выход 4, отказ | ✅ |
| валидация YAML | 10 записей, 10 уникальных id, config цел | ✅ |

## Что осталось незакрытым (осознанно)

1. **`@deepseek-ai/dsh-credentials@0.0.1-rc.1`** затеняет платформенную копию `0.1.5-rc.2`
   для `dsh-tts`, `dsh-voice`, `dsh-vision-toolkit`. Импортируемый ими `credentialRef`
   присутствует в обеих версиях → функциональной поломки нет. Требует отдельного решения
   (правка `package.json` + установка), поэтому в этот apply не входит.
2. **`dsh-client-ui-skins` → `dsh-client-runtime`/`ui-slots` rc.7 вместо ≥rc.8.**
   rc.7 резолвится из dev-чекаута `C:\Users\VoilT\deepseek-harness\packages\client\runtime`,
   `@deepseek-ai/dsh-client-store` отсутствует. Код плагина рассчитан на обе генерации
   (try/catch), а сам плагин выключен. Платформенное расхождение — вне рамок «только явные ошибки».
3. **Осиротевшие id** `dsh-whale-widget` (пакет не установлен) и `ui-theme-cyberpunk`
   (не в bundles) дают только `warn("patch: entry ... not found")`. Оставлены как есть —
   это предупреждения, а не ошибки.
