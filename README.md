# Проверка линий перед арендой

Веб-сервис проверки российских телефонных номеров **перед арендой под исходящий обзвон**. Каждая линия проверяется через [KtoZvonil](https://ktozvonil.net) и другие базы: цель — не брать номера, с которых абонент увидит «Спам» или «Мошенник».

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
79999999999
```

CSV (заголовок опционален):

```
phone
79999999999
```

## Прокси для KtoZvonil (Vercel)

На Vercel запросы к KtoZvonil часто блокируются. Укажите HTTP(S)-прокси с российским IP:

```bash
# .env.local и Vercel → Settings → Environment Variables
KTOZVONIL_PROXY_URL=http://логин:пароль@хост:порт
```

Формат как у обычного HTTP-прокси. SOCKS5 пока не поддерживается — нужен HTTP/HTTPS.

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

## Стек

- Next.js 14+ (App Router)
- TypeScript
- Tailwind CSS
