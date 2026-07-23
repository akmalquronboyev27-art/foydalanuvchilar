# Kep.uz — Foydalanuvchilar jadvali

React + Vite + Tailwind + Axios asosida qurilgan "Foydalanuvchilar" sahifasi.

## O'rnatish

```bash
npm install
```

## Ishga tushirish (dev server)

```bash
npm run dev
```

Brauzerda `http://localhost:5173` ochiladi.

## Production build

```bash
npm run build
npm run preview
```

## Papka strukturasi

```
users-app/
├── index.html
├── package.json
├── vite.config.js
├── tailwind.config.js
├── postcss.config.js
└── src/
    ├── main.jsx           # kirish nuqtasi
    ├── App.jsx            # asosiy komponent
    ├── index.css          # Tailwind
    └── components/
        └── UsersTable.jsx # jadval logikasi (axios, qidiruv, saralash, pagination)
```

## Eslatmalar

- API: `https://kep.uz/api/users` (axios orqali chaqiriladi, `src/components/UsersTable.jsx` ichida `API_BASE` o'zgaruvchisi).
- Backend hozircha `page` / `pageSize` / `ordering` / `search` parametrlarini to'liq qo'llamasa ham, frontend client-side fallback bilan ishlaydi (qidiruv, saralash, sahifalash brauzerda ham amalga oshadi).
- `country` va `age` maydonlari API javobida yo'q — ustunlar/filtrlar tayyor, backend qo'shganda avtomatik ishga tushadi (`COUNTRY_FIELD`, `AGE_FIELD` o'zgaruvchilari orqali).
- Agar `kep.uz` CORS sozlamasi frontend domeningizga ruxsat bermasa, so'rov xato qaytaradi — bu holda backend tomonda CORS header qo'shish yoki proxy orqali chaqirish kerak bo'ladi.
