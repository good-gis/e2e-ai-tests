# Спецификация: e2e-ai-tests

## Обзор

**e2e-ai-tests** — фреймворк для E2E-тестирования нового поколения, где тесты описываются на естественном языке в Markdown-формате, а LLM выполняет их, управляя браузером через MCP (Model Context Protocol).

### Ключевая идея
Вместо написания хрупких селекторов и императивного кода, автор теста описывает **что** нужно сделать на естественном языке. LLM интерпретирует инструкции, анализирует UI и выполняет действия как реальный пользователь.

---

## Архитектура

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Markdown      │     │    e2e-ai-tests │     │   MCP Server    │
│   Test Files    │────▶│    (Runner)     │────▶│  (Playwright)   │
└─────────────────┘     └────────┬────────┘     └────────┬────────┘
                                 │                       │
                        ┌────────▼────────┐     ┌────────▼────────┐
                        │   LLM Provider  │     │     Chrome      │
                        │  (Vercel AI SDK)│     │    Browser      │
                        └─────────────────┘     └─────────────────┘
```

### Компоненты

1. **Test Runner** — ядро системы, читает тесты, управляет выполнением
2. **LLM Adapter** — абстракция над LLM через Vercel AI SDK
3. **MCP Client** — подключение к @anthropic/playwright MCP-серверу
4. **Reporter** — консольный вывод результатов

---

## Формат тестов

Тесты пишутся в Markdown с секциями. Поддерживается мультиязычность (русский и английский).

### Структура файла теста

```markdown
# Название теста

## Описание
Краткое описание что проверяет этот тест.

## URL
https://example.com

## Шаги
1. Найти поле ввода для новой задачи
2. Ввести текст "Купить молоко"
3. Нажать Enter

## Ожидаемый результат
- На странице должна появиться задача с текстом "Купить молоко"
- Поле ввода должно быть очищено
```

### Секции

| Секция | Обязательность | Описание |
|--------|----------------|----------|
| `# Название` | Да | Заголовок первого уровня — название теста |
| `## Описание` | Нет | Текстовое описание цели теста |
| `## URL` | Да | Стартовый URL для теста |
| `## Шаги` | Да | Нумерованный список действий |
| `## Ожидаемый результат` | Да | Что должно быть на странице после выполнения |
| `## Предусловия` | Нет | Что должно быть выполнено до теста (fixtures) |

---

## Система assertions

### Гибридный подход

1. **Явные проверки** — автор теста указывает конкретные ожидания в секции "Ожидаемый результат"
2. **LLM-суждение** — для сложных случаев LLM анализирует accessibility tree и/или скриншот и решает, соответствует ли результат ожиданию

### Формат явных проверок

```markdown
## Ожидаемый результат
- Текст "Welcome" присутствует на странице
- Элемент с текстом "Купить молоко" видим
- Количество элементов в списке: 3
```

---

## Входные данные для LLM

### Основной режим: Accessibility Tree

По умолчанию LLM получает accessibility tree страницы — облегчённое представление DOM с ролями, лейблами и состояниями элементов. Это:
- Дешевле по токенам
- Достаточно для большинства взаимодействий
- Соответствует тому, как работают screen readers

### Скриншоты при ошибках

Скриншот делается когда:
- Произошла ошибка выполнения
- LLM не может найти элемент
- Включён режим отладки

---

## Конфигурация

### Файл `e2e.config.json`

```json
{
  "llm": {
    "provider": "anthropic",
    "model": "claude-sonnet-4-20250514",
    "apiKey": "${ANTHROPIC_API_KEY}"
  },
  "browser": {
    "headless": true,
    "viewport": {
      "width": 1280,
      "height": 720
    }
  },
  "execution": {
    "maxStepsPerTest": 50,
    "retryAttempts": 3,
    "timeout": 30000
  },
  "tests": {
    "pattern": "tests/**/*.md"
  },
  "debug": {
    "screenshots": "on-failure",
    "logSteps": true,
    "headed": false
  },
  "history": {
    "enabled": true,
    "directory": ".e2e-results"
  }
}
```

### Переменные окружения

| Переменная | Описание |
|------------|----------|
| `ANTHROPIC_API_KEY` | API ключ для Claude |
| `E2E_HEADED` | Запуск с видимым браузером (true/false) |
| `E2E_DEBUG` | Включить расширенное логирование |

---

## MCP интеграция

### Используемый сервер
`@anthropic/playwright` — официальный MCP-сервер от Anthropic на базе Playwright.

### Доступные действия

| Действие | Описание |
|----------|----------|
| `navigate` | Переход по URL |
| `click` | Клик по элементу |
| `type` | Ввод текста |
| `screenshot` | Снимок экрана |
| `wait` | Ожидание условия |
| `get_accessibility_tree` | Получить a11y tree страницы |

---

## Retry логика

### Конфигурируемые параметры

- `retryAttempts` — максимальное число попыток (default: 3)
- `timeout` — таймаут на шаг в мс (default: 30000)

### Поведение

1. При неудаче действия (элемент не найден, таймаут) — автоматический retry
2. Между попытками — экспоненциальная задержка
3. После исчерпания попыток — тест помечается как failed
4. LLM получает информацию об ошибке и может попробовать альтернативный подход

---

## Fixtures и состояние

### Поддержка beforeAll

```markdown
# Login fixture

## URL
https://example.com/login

## Шаги
1. Ввести email "test@example.com"
2. Ввести пароль "password123"
3. Нажать кнопку "Войти"

## Сохранить
- cookies
- localStorage
```

### Использование в тестах

```markdown
# Создание заказа

## Предусловия
- Login fixture

## Шаги
...
```

---

## CLI интерфейс

### Команды

```bash
# Запуск всех тестов
npx e2e-ai-tests run

# Запуск конкретного теста
npx e2e-ai-tests run tests/todo.md

# Запуск с видимым браузером
npx e2e-ai-tests run --headed

# Запуск с расширенной отладкой
npx e2e-ai-tests run --debug
```

### Флаги

| Флаг | Описание |
|------|----------|
| `--headed` | Запуск с видимым браузером |
| `--debug` | Подробное логирование + скриншоты на каждом шаге |
| `--config <path>` | Путь к конфигу |
| `--grep <pattern>` | Фильтр по названию теста |

---

## Структура проекта

```
project/
├── e2e.config.json        # Конфигурация
├── tests/                 # Тесты
│   ├── todo-add.md
│   ├── todo-complete.md
│   └── fixtures/          # Fixtures
│       └── login.md
├── .e2e-results/          # История результатов
│   └── 2024-01-15-10-30/
│       ├── results.json
│       └── screenshots/
└── node_modules/
```

---

## Reporting

### Консольный вывод

```
e2e-ai-tests v0.1.0

Running tests...

✓ Добавление задачи (4.2s)
  ├─ Navigate to https://good-gis.github.io/todo-list-app/
  ├─ Found input field with placeholder "What needs to be done?"
  ├─ Typed "Купить молоко"
  ├─ Pressed Enter
  └─ ✓ Assertion: задача "Купить молоко" появилась в списке

✗ Удаление задачи (8.1s)
  ├─ Navigate to https://good-gis.github.io/todo-list-app/
  ├─ Added task "Тестовая задача"
  ├─ ✗ Could not find delete button
  └─ Screenshot saved: .e2e-results/screenshots/delete-task-001.png

Tests: 1 passed, 1 failed
Time: 12.3s
```

### История выполнения

Результаты сохраняются в `.e2e-results/` в JSON-формате:

```json
{
  "timestamp": "2024-01-15T10:30:00Z",
  "tests": [
    {
      "name": "Добавление задачи",
      "status": "passed",
      "duration": 4200,
      "steps": [...]
    }
  ]
}
```

---

## Отладка

### Три режима отладки

1. **Логи всех шагов** — `--debug` или `logSteps: true`
2. **Скриншоты на каждом шаге** — `--debug` включает автоматически
3. **Headed mode** — `--headed` для наблюдения в реальном времени

### Просмотр reasoning LLM

При включённой отладке выводятся рассуждения LLM:

```
[LLM] Looking for input field...
[LLM] Found element: role=textbox, name="What needs to be done?"
[LLM] Typing text: "Купить молоко"
```

---

## LLM провайдеры

### Vercel AI SDK

Используем Vercel AI SDK для абстракции над провайдерами:

```typescript
import { anthropic } from '@ai-sdk/anthropic';
import { openai } from '@ai-sdk/openai';

// Легко переключаться между провайдерами
const model = anthropic('claude-sonnet-4-20250514');
// или
const model = openai('gpt-4o');
```

### Поддерживаемые провайдеры

- **Anthropic Claude** (рекомендуемый, по умолчанию)
- OpenAI GPT-4
- Любой совместимый с Vercel AI SDK

---

## System prompt

### Hardcoded промпт

Фиксированный системный промпт, оптимизированный для E2E-тестирования:

```
You are an E2E test executor. Your task is to perform actions on web pages
based on natural language instructions.

You have access to browser automation tools via MCP.

For each step:
1. Analyze the current accessibility tree
2. Identify the target element
3. Perform the required action
4. Verify the result

Be precise with element selection. Prefer accessibility roles and labels
over visual appearance.
```

---

## Ограничения и лимиты

### Стоимость и производительность

| Параметр | Лимит |
|----------|-------|
| Макс шагов на тест | 50 (конфигурируемо) |
| Таймаут на шаг | 30 сек |
| Retry attempts | 3 |

### Воспроизводимость

Для повышения детерминированности:
- `temperature: 0` для LLM
- Фиксированный system prompt
- Seed параметр (если поддерживается провайдером)

---

## Пример теста для TodoMVC

### Файл: `tests/todo-add.md`

```markdown
# Добавление задачи в TodoMVC

## Описание
Проверяет базовый функционал добавления новой задачи в список.

## URL
https://good-gis.github.io/todo-list-app/

## Шаги
1. Найти поле ввода для новой задачи
2. Ввести текст "Купить молоко"
3. Нажать Enter для добавления задачи

## Ожидаемый результат
- В списке задач появился элемент с текстом "Купить молоко"
- Поле ввода очищено и готово для следующей задачи
- Счётчик задач показывает "1 item left" (или аналогичное)
```

---

## CI/CD

### Поддержка

- Headless режим по умолчанию
- Exit codes для интеграции
- JSON-отчёты для парсинга

### Exit codes

| Код | Значение |
|-----|----------|
| 0 | Все тесты прошли |
| 1 | Есть упавшие тесты |
| 2 | Ошибка конфигурации |

---

## Риски и mitigation

### Недетерминизм LLM
- **Mitigation**: temperature=0, seed, логирование всех решений

### Стоимость API
- **Mitigation**: лимит шагов, использование a11y tree вместо скриншотов, выбор модели

### Скорость
- **Mitigation**: последовательное выполнение (проще отлаживать), возможность replay в будущем

---

## Roadmap (не в MVP)

1. **Replay mode** — запись действий LLM для повторного выполнения без LLM
2. **Параллельное выполнение** — запуск тестов в нескольких браузерах
3. **HTML отчёты** — красивые интерактивные отчёты
4. **Visual regression** — сравнение скриншотов

---

## Технический стек

- **Runtime**: Node.js / TypeScript
- **LLM**: Vercel AI SDK + @ai-sdk/anthropic
- **Browser automation**: MCP (@anthropic/playwright)
- **CLI**: Commander.js или yargs
- **Markdown parsing**: marked или remark

---

*Спецификация v0.1 — Usable MVP*
