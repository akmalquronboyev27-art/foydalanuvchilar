import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import axios from "axios";

/**
 * "Foydalanuvchilar" jadvali — TO'LIQ FUNKSIONAL DEMO.
 *
 * API: GET https://randomuser.me/api/  (bepul, CORS ochiq, auth kerak emas)
 *
 * Nega bu API tanlandi:
 *  - kep.uz/api/users hozircha page/pageSize/ordering/search parametrlarini
 *    to'liq qo'llamayapti va "country"/"age" maydonlarini umuman qaytarmaydi.
 *  - randomuser.me esa country (nat) va age (dob.age) ni tayyor beradi —
 *    shu sabab Davlat filtri va Yosh oralig'i shu yerda TO'LIQ ishlaydi.
 *
 * kep.uz tayyor bo'lganda orqaga qaytarish:
 *  1) API_BASE ni "https://kep.uz/api/users" ga o'zgartiring
 *  2) fetchAllUsers() ichidagi transformUser() funksiyasini olib tashlang,
 *     backend javobini to'g'ridan-to'g'ri ishlating (avvalgi versiyada bor edi)
 *  3) kepcoin/skillsRating/activityRating/streak/lastSeen — bular haqiqiy
 *     backend maydonlaridan keladi, generatePseudoStats() shart emas bo'ladi.
 */

const API_BASE = "https://randomuser.me/api/";
const TOTAL_USERS = 10000; // jami nechta foydalanuvchi kerak
const BATCH_SIZE = 5000; // randomuser.me bitta so'rovda beradigan MAKSIMAL son
const SEED = "kep-uz-demo"; // har safar bir xil ma'lumot chiqishi uchun
const PAGE_SIZE_OPTIONS = [10, 20, 50];

function classNames(...xs) {
  return xs.filter(Boolean).join(" ");
}

function fullName(u) {
  const n = `${u.firstName || ""} ${u.lastName || ""}`.trim();
  return n || "—";
}

function avatarColor(seed) {
  const palette = ["#F0B429", "#2DD4BF", "#818CF8", "#F472B6", "#4ADE80", "#60A5FA"];
  let h = 0;
  for (let i = 0; i < (seed || "").length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return palette[h % palette.length];
}

function initials(firstName, lastName, username) {
  const a = (firstName || "").trim();
  const b = (lastName || "").trim();
  if (a || b) return `${a[0] || ""}${b[0] || ""}`.toUpperCase() || "?";
  return (username || "?").slice(0, 2).toUpperCase();
}

// nat kod (masalan "US") -> bayroq emoji
function flagFromCountryCode(code) {
  if (!code || code.length !== 2) return "🌐";
  const A = 0x1f1e6;
  const chars = code
    .toUpperCase()
    .split("")
    .map((c) => String.fromCodePoint(A + (c.charCodeAt(0) - 65)));
  return chars.join("");
}

// uuid asosida barqaror pseudo-random son generatori (mulberry32)
function seededRandom(seedStr) {
  let h = 1779033703 ^ seedStr.length;
  for (let i = 0; i < seedStr.length; i++) {
    h = Math.imul(h ^ seedStr.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return function () {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  };
}

// kep.uz da hali mavjud bo'lmagan lekin UI uchun kerak bo'lgan
// (kepcoin, reyting, streak, oxirgi kirish) qiymatlarni barqaror generatsiya qiladi.
function generatePseudoStats(uuid) {
  const rnd = seededRandom(uuid);
  const kepcoin = Math.floor(rnd() * 5000);
  const skillsRating = (rnd() * 150).toFixed(1);
  const activityRating = Number((rnd() * 100).toFixed(1));
  const streak = Math.floor(rnd() * 25);
  const daysAgo = Math.floor(rnd() * 400);
  let lastSeen;
  if (daysAgo === 0) lastSeen = "bugun";
  else if (daysAgo < 1) lastSeen = "bir necha soat oldin";
  else if (daysAgo < 30) lastSeen = `${daysAgo} kun oldin`;
  else if (daysAgo < 365) lastSeen = `${Math.floor(daysAgo / 30)} oy oldin`;
  else lastSeen = `${Math.floor(daysAgo / 365)} yil oldin`;
  return { kepcoin, skillsRating, activityRating, streak, lastSeen, _lastSeenDays: daysAgo };
}

function transformUser(apiUser) {
  const stats = generatePseudoStats(apiUser.login.uuid);
  return {
    id: apiUser.login.uuid,
    username: apiUser.login.username,
    firstName: apiUser.name.first,
    lastName: apiUser.name.last,
    avatar: apiUser.picture.large,
    country: apiUser.location.country,
    countryCode: apiUser.nat,
    age: apiUser.dob.age,
    ...stats,
  };
}

function CoinIcon({ size = 14 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <circle cx="10" cy="10" r="9" fill="#F0B429" stroke="#B8860B" strokeWidth="1" />
      <circle cx="10" cy="10" r="6" fill="none" stroke="#B8860B" strokeWidth="1" opacity="0.6" />
      <text x="10" y="13.5" fontSize="8" fontWeight="700" fill="#8A5A00" textAnchor="middle">₭</text>
    </svg>
  );
}

function SortIcon({ dir }) {
  return (
    <span className="inline-flex flex-col ml-1 leading-none -space-y-1 align-middle">
      <svg width="8" height="6" viewBox="0 0 8 6" className={dir === "asc" ? "opacity-100" : "opacity-30"}>
        <path d="M4 0L8 6H0Z" fill="currentColor" />
      </svg>
      <svg width="8" height="6" viewBox="0 0 8 6" className={dir === "desc" ? "opacity-100" : "opacity-30"}>
        <path d="M4 6L0 0H8Z" fill="currentColor" />
      </svg>
    </span>
  );
}

function SkeletonRow() {
  return (
    <tr className="border-b border-[#2A2A2A]">
      <td className="py-3 px-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-[#2A2A2A] animate-pulse" />
          <div className="space-y-1.5">
            <div className="h-3 w-24 bg-[#2A2A2A] rounded animate-pulse" />
            <div className="h-2.5 w-16 bg-[#1A1A1A] rounded animate-pulse" />
          </div>
        </div>
      </td>
      <td className="py-3 px-4"><div className="h-3 w-28 bg-[#2A2A2A] rounded animate-pulse" /></td>
      <td className="py-3 px-4"><div className="h-3 w-16 bg-[#2A2A2A] rounded animate-pulse" /></td>
      <td className="py-3 px-4"><div className="h-3 w-8 bg-[#2A2A2A] rounded animate-pulse" /></td>
      <td className="py-3 px-4"><div className="h-3 w-16 bg-[#2A2A2A] rounded animate-pulse" /></td>
      <td className="py-3 px-4"><div className="h-3 w-20 bg-[#2A2A2A] rounded animate-pulse" /></td>
    </tr>
  );
}

export default function UsersTable() {
  const [allUsers, setAllUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [sortField, setSortField] = useState("activityRating");
  const [sortDir, setSortDir] = useState("desc");
  const [countryFilter, setCountryFilter] = useState([]);
  const [ageRange, setAgeRange] = useState([0, 100]);

  const debounceRef = useRef(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 400);
    return () => clearTimeout(debounceRef.current);
  }, [searchInput]);

  const fetchAllUsers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const batchCount = Math.ceil(TOTAL_USERS / BATCH_SIZE);
      const requests = Array.from({ length: batchCount }, (_, i) =>
        axios.get(API_BASE, {
          params: { results: BATCH_SIZE, seed: SEED, page: i + 1 },
        })
      );
      const responses = await Promise.all(requests);
      const list = responses.flatMap((res) => (res.data?.results || []).map(transformUser));
      setAllUsers(list);
    } catch (e) {
      const status = e.response?.status;
      const msg = e.response?.data?.message || e.message || "Noma'lum xato";
      setError(status ? `API xatosi: ${status} — ${msg}` : msg);
      setAllUsers([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAllUsers();
  }, [fetchAllUsers]);

  // Ma'lumotdagi haqiqiy davlatlar ro'yxati (filtr uchun)
  const countryOptions = useMemo(() => {
    const map = new Map();
    allUsers.forEach((u) => {
      if (!map.has(u.countryCode)) map.set(u.countryCode, u.country);
    });
    return Array.from(map.entries())
      .map(([code, name]) => ({ code, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [allUsers]);

  const [ageBounds, setAgeBounds] = useState([18, 90]);
  useEffect(() => {
    if (allUsers.length) {
      const ages = allUsers.map((u) => u.age);
      const bounds = [Math.min(...ages), Math.max(...ages)];
      setAgeBounds(bounds);
      setAgeRange(bounds);
    }
  }, [allUsers]);

  const orderingKey = useMemo(() => (sortField === "fullName" ? "firstName" : sortField), [sortField]);

  // Qidiruv + filtr + saralash — TO'LIQ ishlaydi (real API ma'lumotlari asosida)
  const filteredSorted = useMemo(() => {
    let list = [...allUsers];

    if (search) {
      const q = search.toLowerCase();
      list = list.filter(
        (u) =>
          (u.username || "").toLowerCase().includes(q) ||
          (u.firstName || "").toLowerCase().includes(q) ||
          (u.lastName || "").toLowerCase().includes(q)
      );
    }

    if (countryFilter.length) {
      list = list.filter((u) => countryFilter.includes(u.countryCode));
    }

    list = list.filter((u) => u.age >= ageRange[0] && u.age <= ageRange[1]);

    list.sort((a, b) => {
      let va = a[orderingKey];
      let vb = b[orderingKey];
      if (typeof va === "string") va = va.toLowerCase();
      if (typeof vb === "string") vb = vb.toLowerCase();
      if (va == null) va = sortDir === "desc" ? -Infinity : Infinity;
      if (vb == null) vb = sortDir === "desc" ? -Infinity : Infinity;
      if (va < vb) return sortDir === "asc" ? -1 : 1;
      if (va > vb) return sortDir === "asc" ? 1 : -1;
      return 0;
    });

    return list;
  }, [allUsers, search, countryFilter, ageRange, orderingKey, sortDir]);

  const total = filteredSorted.length;
  const pagesCount = Math.max(1, Math.ceil(total / pageSize));
  const currentPage = Math.min(page, pagesCount);
  const fromIdx = total ? (currentPage - 1) * pageSize + 1 : 0;
  const toIdx = total ? Math.min(currentPage * pageSize, total) : 0;

  const displayUsers = useMemo(
    () => filteredSorted.slice((currentPage - 1) * pageSize, currentPage * pageSize),
    [filteredSorted, currentPage, pageSize]
  );

  const toggleSort = (field) => {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir("desc");
    }
    setPage(1);
  };

  const toggleCountry = (code) => {
    setCountryFilter((prev) => (prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]));
    setPage(1);
  };

  const paginationItems = useMemo(() => {
    const items = [];
    const windowSize = 1;
    const push = (v) => items.push(v);
    push(1);
    if (currentPage - windowSize > 2) push("...");
    for (let p = Math.max(2, currentPage - windowSize); p <= Math.min(pagesCount - 1, currentPage + windowSize); p++) {
      push(p);
    }
    if (currentPage + windowSize < pagesCount - 1) push("...");
    if (pagesCount > 1) push(pagesCount);
    return items;
  }, [currentPage, pagesCount]);

  return (
    <div className="min-h-screen w-full bg-black text-[#E8EAF0]" style={{ fontFamily: "'Inter', ui-sans-serif, system-ui, sans-serif" }}>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">

        <div className="flex items-end justify-between flex-wrap gap-4 mb-6">
          <div>
            <div className="text-[11px] tracking-[0.2em] text-[#F0B429] font-semibold uppercase mb-1">Kep.uz · Reyting (demo)</div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight" style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace" }}>
              Foydalanuvchilar
            </h1>
          </div>
          <div className="text-sm text-[#8B93A7]">
            Jami: <span className="text-[#E8EAF0] font-semibold">{total.toLocaleString("ru-RU")}</span> foydalanuvchi
          </div>
        </div>

        <div className="bg-[#121212] border border-[#2A2A2A] rounded-2xl p-4 mb-4 flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8B93A7]" width="16" height="16" viewBox="0 0 24 24" fill="none">
                <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
                <path d="M21 21L16.65 16.65" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
              <input
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Nik yoki ism bo'yicha qidirish..."
                className="w-full bg-black border border-[#2A2A2A] rounded-xl pl-9 pr-3 py-2.5 text-sm placeholder:text-[#5A6377] outline-none focus:border-[#F0B429] transition-colors"
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-[#8B93A7] whitespace-nowrap">Sahifada:</span>
              <select
                value={pageSize}
                onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}
                className="bg-black border border-[#2A2A2A] rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#F0B429] cursor-pointer"
              >
                {PAGE_SIZE_OPTIONS.map((n) => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-4 pt-3 border-t border-[#2A2A2A]">
            {/* Davlat — real, ko'p tanlovli */}
            <div className="flex-1">
              <div className="text-xs text-[#8B93A7] mb-2 flex items-center justify-between">
                <span>Davlat {countryFilter.length > 0 && <span className="text-[#F0B429]">({countryFilter.length})</span>}</span>
                {countryFilter.length > 0 && (
                  <button onClick={() => { setCountryFilter([]); setPage(1); }} className="text-[#5A6377] hover:text-[#F0B429]">
                    Tozalash
                  </button>
                )}
              </div>
              <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto pr-1">
                {countryOptions.map((c) => (
                  <button
                    key={c.code}
                    onClick={() => toggleCountry(c.code)}
                    className={classNames(
                      "text-xs px-2.5 py-1.5 rounded-lg border transition-colors flex items-center gap-1.5",
                      countryFilter.includes(c.code)
                        ? "bg-[#F0B429] border-[#F0B429] text-black font-semibold"
                        : "border-[#2A2A2A] text-[#8B93A7] hover:border-[#F0B429] hover:text-[#F0B429]"
                    )}
                  >
                    <span>{flagFromCountryCode(c.code)}</span>
                    {c.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Yosh — real diapazon, ikkita input */}
            <div className="sm:w-56 flex-shrink-0">
              <div className="text-xs text-[#8B93A7] mb-2">Yosh oralig'i</div>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={ageBounds[0]}
                  max={ageRange[1]}
                  value={ageRange[0]}
                  onChange={(e) => { setAgeRange([Number(e.target.value), ageRange[1]]); setPage(1); }}
                  className="w-full bg-black border border-[#2A2A2A] rounded-xl px-3 py-2 text-sm outline-none focus:border-[#F0B429]"
                />
                <span className="text-[#5A6377]">—</span>
                <input
                  type="number"
                  min={ageRange[0]}
                  max={ageBounds[1]}
                  value={ageRange[1]}
                  onChange={(e) => { setAgeRange([ageRange[0], Number(e.target.value)]); setPage(1); }}
                  className="w-full bg-black border border-[#2A2A2A] rounded-xl px-3 py-2 text-sm outline-none focus:border-[#F0B429]"
                />
              </div>
            </div>
          </div>
        </div>

        {error && (
          <div className="bg-[#2A1418] border border-[#5C2530] text-[#F5A3AE] rounded-xl px-4 py-3 mb-4 text-sm flex items-start gap-2">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" className="mt-0.5 flex-shrink-0">
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />
              <path d="M12 8V13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              <circle cx="12" cy="16.5" r="1" fill="currentColor" />
            </svg>
            <div>
              <div className="font-semibold">Ma'lumotni yuklab bo'lmadi</div>
              <div className="text-[#D98E97]">{error}</div>
            </div>
          </div>
        )}

        {/* Desktop table */}
        <div className="hidden lg:block bg-[#121212] border border-[#2A2A2A] rounded-2xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[#0A0A0A] border-b border-[#2A2A2A] text-left text-[#8B93A7] text-xs uppercase tracking-wide">
                <th className="py-3 px-4 font-medium cursor-pointer select-none" onClick={() => toggleSort("username")}>
                  <span className="inline-flex items-center">Foydalanuvchi<SortIcon dir={sortField === "username" ? sortDir : null} /></span>
                </th>
                <th className="py-3 px-4 font-medium cursor-pointer select-none" onClick={() => toggleSort("fullName")}>
                  <span className="inline-flex items-center">Nomi<SortIcon dir={sortField === "fullName" ? sortDir : null} /></span>
                </th>
                <th className="py-3 px-4 font-medium cursor-pointer select-none" onClick={() => toggleSort("country")}>
                  <span className="inline-flex items-center">Davlat<SortIcon dir={sortField === "country" ? sortDir : null} /></span>
                </th>
                <th className="py-3 px-4 font-medium cursor-pointer select-none" onClick={() => toggleSort("age")}>
                  <span className="inline-flex items-center">Yosh<SortIcon dir={sortField === "age" ? sortDir : null} /></span>
                </th>
                <th className="py-3 px-4 font-medium cursor-pointer select-none" onClick={() => toggleSort("kepcoin")}>
                  <span className="inline-flex items-center">Kepcoin<SortIcon dir={sortField === "kepcoin" ? sortDir : null} /></span>
                </th>
                <th className="py-3 px-4 font-medium cursor-pointer select-none" onClick={() => toggleSort("_lastSeenDays")}>
                  <span className="inline-flex items-center">Oxirgi kirish<SortIcon dir={sortField === "_lastSeenDays" ? sortDir : null} /></span>
                </th>
              </tr>
            </thead>
            <tbody>
              {loading && Array.from({ length: pageSize > 10 ? 8 : pageSize }).map((_, i) => <SkeletonRow key={i} />)}

              {!loading && displayUsers.length === 0 && !error && (
                <tr>
                  <td colSpan={6} className="py-16 text-center">
                    <div className="text-[#5A6377] text-sm">
                      <div className="text-3xl mb-2">🔍</div>
                      Hech narsa topilmadi
                      <div className="text-xs mt-1">Qidiruv so'zini yoki filtrlarni o'zgartirib ko'ring</div>
                    </div>
                  </td>
                </tr>
              )}

              {!loading && displayUsers.map((u) => (
                <tr key={u.id} className="border-b border-[#1A1A1A] hover:bg-[#1A1A1A] transition-colors">
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-3">
                      {u.avatar ? (
                        <img src={u.avatar} alt={u.username} className="w-9 h-9 rounded-full object-cover bg-[#2A2A2A]"
                          onError={(e) => { e.currentTarget.style.display = "none"; e.currentTarget.nextSibling.style.display = "flex"; }} />
                      ) : null}
                      <div
                        className="w-9 h-9 rounded-full items-center justify-center text-xs font-bold text-black flex-shrink-0"
                        style={{ background: avatarColor(u.username || String(u.id)), display: u.avatar ? "none" : "flex" }}
                      >
                        {initials(u.firstName, u.lastName, u.username)}
                      </div>
                      <div>
                        <div className="font-semibold" style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace" }}>{u.username}</div>
                        {u.streak > 0 && (
                          <div className="text-[11px] text-[#F0B429] flex items-center gap-1">🔥 {u.streak} kun streak</div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="py-3 px-4 text-[#C7CCDA]">{fullName(u)}</td>
                  <td className="py-3 px-4 text-[#C7CCDA]">
                    <span className="inline-flex items-center gap-1.5">
                      <span>{flagFromCountryCode(u.countryCode)}</span> {u.country}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-[#C7CCDA]">{u.age}</td>
                  <td className="py-3 px-4">
                    <span className="inline-flex items-center gap-1.5 font-semibold text-[#F0D090]">
                      <CoinIcon /> {Number(u.kepcoin || 0).toLocaleString("ru-RU")}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-[#8B93A7]">{u.lastSeen || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile cards */}
        <div className="lg:hidden space-y-3">
          {loading && Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-[#121212] border border-[#2A2A2A] rounded-2xl p-4 animate-pulse">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-[#2A2A2A]" />
                <div className="space-y-2 flex-1">
                  <div className="h-3 w-1/2 bg-[#2A2A2A] rounded" />
                  <div className="h-2.5 w-1/3 bg-[#1A1A1A] rounded" />
                </div>
              </div>
            </div>
          ))}

          {!loading && displayUsers.length === 0 && !error && (
            <div className="bg-[#121212] border border-[#2A2A2A] rounded-2xl py-16 text-center text-[#5A6377]">
              <div className="text-3xl mb-2">🔍</div>
              Hech narsa topilmadi
            </div>
          )}

          {!loading && displayUsers.map((u) => (
            <div key={u.id} className="bg-[#121212] border border-[#2A2A2A] rounded-2xl p-4">
              <div className="flex items-center gap-3 mb-3">
                {u.avatar ? (
                  <img src={u.avatar} alt={u.username} className="w-10 h-10 rounded-full object-cover bg-[#2A2A2A]"
                    onError={(e) => { e.currentTarget.style.display = "none"; e.currentTarget.nextSibling.style.display = "flex"; }} />
                ) : null}
                <div
                  className="w-10 h-10 rounded-full items-center justify-center text-xs font-bold text-black flex-shrink-0"
                  style={{ background: avatarColor(u.username || String(u.id)), display: u.avatar ? "none" : "flex" }}
                >
                  {initials(u.firstName, u.lastName, u.username)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-semibold truncate" style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace" }}>{u.username}</div>
                  <div className="text-xs text-[#8B93A7] truncate">
                    {flagFromCountryCode(u.countryCode)} {fullName(u)} · {u.age} yosh
                  </div>
                </div>
                <span className="inline-flex items-center gap-1 text-sm font-semibold text-[#F0D090] flex-shrink-0">
                  <CoinIcon /> {Number(u.kepcoin || 0).toLocaleString("ru-RU")}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs text-[#8B93A7] pt-3 border-t border-[#1A1A1A]">
                <span>Reyting: <span className="text-[#C7CCDA]">{u.activityRating ?? "—"}</span></span>
                <span>{u.lastSeen || "—"}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Footer / pagination */}
        {!loading && total > 0 && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-5 text-sm">
            <div className="text-[#8B93A7]">
              <span className="text-[#E8EAF0]">{fromIdx}–{toIdx}</span> / {total.toLocaleString("ru-RU")} ta ko'rsatilmoqda
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-3 py-1.5 rounded-lg border border-[#2A2A2A] text-[#8B93A7] disabled:opacity-30 hover:border-[#F0B429] hover:text-[#F0B429] transition-colors disabled:hover:border-[#2A2A2A] disabled:hover:text-[#8B93A7]"
              >
                ‹
              </button>
              {paginationItems.map((it, i) =>
                it === "..." ? (
                  <span key={`e${i}`} className="px-2 text-[#5A6377]">…</span>
                ) : (
                  <button
                    key={it}
                    onClick={() => setPage(it)}
                    className={classNames(
                      "min-w-[34px] px-2.5 py-1.5 rounded-lg border transition-colors",
                      it === currentPage
                        ? "bg-[#F0B429] border-[#F0B429] text-black font-semibold"
                        : "border-[#2A2A2A] text-[#8B93A7] hover:border-[#F0B429] hover:text-[#F0B429]"
                    )}
                  >
                    {it}
                  </button>
                )
              )}
              <button
                onClick={() => setPage((p) => Math.min(pagesCount, p + 1))}
                disabled={currentPage === pagesCount}
                className="px-3 py-1.5 rounded-lg border border-[#2A2A2A] text-[#8B93A7] disabled:opacity-30 hover:border-[#F0B429] hover:text-[#F0B429] transition-colors disabled:hover:border-[#2A2A2A] disabled:hover:text-[#8B93A7]"
              >
                ›
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
