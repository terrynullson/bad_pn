# Проверка номеров

Веб-сервис проверки российских телефонных номеров перед исходящим обзвоном. Каждый номер проверяется через [KtoZvonil](https://ktozvonil.net) с формированием вердикта и отчёта.

## Возможности

- Загрузка номеров из TXT/CSV или вставка в textarea
- Нормализация номеров (`8XXXXXXXXXX` → `7XXXXXXXXXX`)
- Вердикты: OK, CAUTION, REJECT, INVALID
- Таблица результатов с раскрытием деталей
- Экспорт результатов в CSV
- Пакетная проверка с прогресс-баром

## Формат входных данных

Один номер на строку, только цифры:

```
79968992714
79968992736
```

CSV (заголовок опционален):

```
phone
79968992714
79968992736
```

## Локальный запуск

```bash
npm install
cp .env.example .env.local   # опционально
npm run dev
```

Откройте [http://localhost:3000](http://localhost:3000).

## Сборка

```bash
npm run build
npm start
```

## Переменные окружения

| Переменная | Описание |
|------------|----------|
| `WHO_CALLS_API_KEY` | Опционально. Ключ SpravPortal WhoCalls API (заглушка, не используется в MVP) |

## Деплой на Vercel

1. Создайте репозиторий на GitHub и запушьте код:
   ```bash
   git remote add origin https://github.com/YOUR_USER/bad_phone_numbers.git
   git push -u origin master
   ```
2. Перейдите на [vercel.com](https://vercel.com) → **Add New Project** → Import GitHub repo.
3. Framework Preset: **Next.js** (определяется автоматически).
4. При необходимости добавьте `WHO_CALLS_API_KEY` в Environment Variables.
5. Нажмите **Deploy**.

### Ограничения Vercel

- На бесплатном тарифе (Hobby) лимит serverless-функции — **10 секунд**. Клиент отправляет батчи по **8 номеров** (1 запрос/сек к KtoZvonil).
- На Pro можно увеличить `maxDuration` до 60 сек и использовать батчи до 25–30 номеров.

## Стек

- Next.js 14+ (App Router)
- TypeScript
- Tailwind CSS
