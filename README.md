# 跑團月曆

跑團月曆是一個可部署到 Vercel 的靜態網站，用於公開展示 TRPG 團務、收集玩家加團申請，並提供 GM / 管理員登入後的團務管理功能。資料與登入機制由 Supabase Auth、Postgres、Row Level Security（RLS）與 Edge Functions 支援。

本 README 的目標讀者是具備基礎電腦與網站管理概念的社群管理員，例如知道如何登入 Supabase / Vercel 後台、設定環境變數、執行 SQL、管理使用者帳號與部署靜態網站。

## 目錄

- [系統功能](#系統功能)
- [角色與權限](#角色與權限)
- [日常營運流程](#日常營運流程)
- [本機預覽](#本機預覽)
- [Supabase 初始化](#supabase-初始化)
- [帳號管理](#帳號管理)
- [忘記密碼與資安檢查](#忘記密碼與資安檢查)
- [通知信設定](#通知信設定)
- [Vercel 部署](#vercel-部署)
- [資料庫與 RLS 維護](#資料庫與-rls-維護)
- [常見問題](#常見問題)
- [參考文件](#參考文件)

## 系統功能

### 公開頁功能

- 月曆與列表兩種檢視模式。
- 訪客可瀏覽公開團務、團務時間、地點、主持人、系統、劇本、剩餘名額等資訊。
- 訪客可開啟 Google Map 連結與 Line 群組連結。
- 訪客可送出加團申請。
- 訪客可送出 GM 帳號申請；申請內容由 Supabase Edge Function 寄給站方。

### GM / 管理員功能

- 使用 Supabase Email / Password 登入。
- 新增、編輯、刪除團務。
- 隱藏團務：不在公開月曆顯示，但登入者仍可管理。
- 關閉報名：團務仍可公開顯示，但訪客不能再送加團申請。
- 查看加團申請並更新狀態：待處理、核准、婉拒。
- 核准申請後，團務的已核准人數與剩餘名額會自動更新。
- 在日期未定的團務建立可跑團時間調查，產生玩家私人連結、查看填寫進度與共同可跑時段。
- 登入後可修改自己的登入密碼。
- 未登入時可透過「忘記密碼 / 寄重設信」進行 Supabase 密碼重設流程。

## 角色與權限

本專案將使用者分為三種操作角色：

| 角色 | 身分來源 | 主要權限 |
| --- | --- | --- |
| 訪客 | 未登入使用者 | 瀏覽公開團務、送出加團申請、送出 GM 帳號申請、填寫玩家可跑團時間調查。 |
| GM | `auth.users` 中的 Supabase 使用者，且存在於 `public.gms` | 新增團務、管理自己建立的團務、管理自己團務的加團申請與可跑團時間調查。 |
| 管理員 | `auth.users` 中的 Supabase 使用者，且存在於 `public.admins` | 管理全部團務、全部申請、通知設定與站務資料。 |

權限由 Supabase RLS policy 控制。前端的按鈕顯示只負責使用體驗，不是主要資安邊界；實際資料讀寫仍必須通過資料庫 policy。

## 日常營運流程

### 建立團務

1. GM 或管理員登入網站。
2. 按「開團」。
3. 填寫團務日期、時間、人數、團名、主持人、系統、劇本、地點與說明。
4. 視需求設定：
   - **本團隱藏**：尚未公開或只作內部管理時使用。
   - **關閉報名**：名額已滿、暫停收件或只想公告資訊時使用。
5. 儲存後，公開團務會顯示在月曆與列表中。

### 管理加團申請

1. GM 或管理員登入網站。
2. 在管理介面查看申請清單。
3. 依實際招募狀況設定申請狀態：
   - **待處理**：尚未決定。
   - **核准**：玩家成功加入，會計入已核准人數。
   - **婉拒**：玩家未加入，不計入人數。
4. 若申請資料為垃圾訊息或測試資料，可刪除該筆申請。

### 使用可跑團時間調查

1. 先建立或編輯一個「日期未定」的團務。
2. 在該團務中建立可跑團時間調查。
3. 設定日期範圍或指定日期，並輸入玩家名稱。
4. 系統會為每位玩家產生私人連結。
5. 將私人連結分別傳給對應玩家。
6. GM 回到管理介面查看玩家填寫狀態、共同可跑時段與多數可跑時段。
7. 確定團期後，可清除調查資料；清除後舊玩家連結會失效。

## 本機預覽

本機需安裝 Node.js。此專案沒有複雜建置流程，主要以靜態檔案方式提供前端頁面。

啟動本機預覽：

```bash
node scripts/dev-server.mjs
```

開啟：

```text
http://localhost:4173
```

若尚未設定 Supabase，頁面會使用本機示範資料，適合檢查畫面與基本互動。

也可執行基本檢查：

```bash
npm run check
```

## Supabase 初始化

### 1. 建立 Supabase project

在 Supabase 建立新的 project，記下：

- Project URL
- Publishable key（`sb_publishable_...`；舊專案可暫時使用 anon public key）

這兩個值會在 Vercel 部署時用到。

### 2. 建立資料表、函式與 RLS policy

到 Supabase SQL Editor 執行：

```sql
-- 將 supabase/schema.sql 的完整內容貼上後執行
```

`supabase/schema.sql` 會建立資料表、索引、trigger、RPC function、grant 與 RLS policy。若之後專案更新，也可以再次執行同一份 schema；檔案內多數物件使用 `create ... if not exists` 或相容的補欄位寫法。

### 3. 設定 Auth URL

到 Supabase Dashboard：

```text
Authentication → URL Configuration
```

設定：

- **Site URL**：正式網站網址，例如 `https://example.vercel.app`
- **Redirect URLs**：加入正式網站網址；若需要測試本機重設密碼，也加入 `http://localhost:4173`

此設定會影響邀請信、登入後導回、忘記密碼重設信等流程。

## 帳號管理

### 建立管理員帳號

1. 到 Supabase Dashboard：

```text
Authentication → Users
```

2. 建立 Email / Password 使用者，或使用 Invite user 邀請站方管理員。
3. 複製該使用者的 User UID。
4. 到 SQL Editor 執行：

```sql
insert into public.admins (user_id, display_name)
values ('貼上管理員 User UID', '管理員名稱')
on conflict (user_id) do update
set display_name = excluded.display_name;
```

### 建立 GM 帳號

建議使用 Supabase 的邀請流程：

1. 確認 [Supabase 初始化](#supabase-初始化) 中的 Auth URL 已設定完成。
2. 到 Authentication / Users 使用 Invite user 邀請 GM 的 Email。
3. 複製該使用者的 User UID。
4. 到 SQL Editor 執行：

```sql
insert into public.gms (user_id, display_name)
values ('貼上 GM User UID', 'GM 顯示名稱')
on conflict (user_id) do update
set display_name = excluded.display_name;
```

5. GM 點開邀請信後回到網站，依 Supabase 流程設定密碼或登入。

若短期內不使用邀請信，也可以由站方在 Authentication / Users 建立帳號與一次性臨時密碼，再要求 GM 首次登入後立即修改密碼。不要透過 GM 申請表單收取密碼，也不要用社群軟體或公開頻道傳送正式密碼。

### 修改 GM 顯示名稱

```sql
update public.gms
set display_name = '新的 GM 顯示名稱'
where user_id = '貼上 GM User UID';
```

### 停用或移除 GM 權限

若只要移除 GM 管理權限，但保留 Supabase Auth 帳號：

```sql
delete from public.gms
where user_id = '貼上 GM User UID';
```

若要完全移除登入帳號，請到 Supabase Dashboard 的 Authentication / Users 刪除該 user。刪除前請先確認該 GM 是否仍有團務資料需要移交或備份。

## 忘記密碼與資安檢查

### 結論

目前的忘記密碼設計屬於 Supabase 標準 Password Recovery 流程：未登入使用者輸入 Email，Supabase 將重設連結寄到該信箱；使用者點擊連結回到網站後，前端收到 `PASSWORD_RECOVERY` auth event，再呼叫 `updateUser({ password })` 更新密碼。

### 已確認的風險與緩解方式

| 風險 | 說明 | 緩解方式 |
| --- | --- | --- |
| 盜用他人 Email 重設密碼 | 攻擊者可輸入別人的 Email 觸發重設信，但無法取得信件內容就不能設定新密碼。 | 要求 GM 保護 Email 信箱，必要時啟用信箱 2FA。 |
| 垃圾重設信 / Email bombing | 公開忘記密碼入口可能被濫用來寄送重設信。 | Supabase Auth 對寄信端點有 rate limit；站方可設定 custom SMTP 與更完整的寄信限制。 |
| Redirect URL 設定錯誤 | 若允許不受信任的 redirect URL，可能讓 recovery link 導向非本站頁面。 | Supabase URL Configuration 只加入正式網站與必要測試網址，不加入萬用或不信任網域。 |
| service role key 外洩 | 若把 service role key 放到前端，攻擊者可繞過 RLS 操作資料與 Auth admin API。 | service role key 只能放在 Supabase Edge Function、可信任 server 或 CI secret，不得放在 `public/` 或瀏覽器程式碼。 |
| 使用 UUID 直接寄信的誤解 | Supabase 前端 reset API 使用 Email，不使用 UUID。 | 若站方只有 Auth UUID，先在 Supabase 後台或 SQL Editor 查出 Email，再執行重設流程。 |
| 帳號枚舉 | 忘記密碼流程若回覆「帳號不存在」，可能洩漏 Email 是否為站內帳號。 | 前端成功訊息採用一般性文字；站務操作不要對外公開使用者 Email 清單。 |

### GM 自助重設密碼

1. GM 開啟網站並按「管理登入」。
2. 在登入視窗輸入自己的 Email。
3. 按「忘記密碼 / 寄重設信」。這一步不需要登入，也不需要舊密碼。
4. 到信箱點開 Supabase 寄出的重設密碼連結。
5. 回到網站後，系統會開啟「修改登入密碼」視窗。
6. 輸入新密碼並送出。
7. 之後使用新密碼登入。

### 站方只有 Auth UUID 時如何處理

Supabase 的 `resetPasswordForEmail` 使用 Email 寄信，不能直接用 Auth UUID 寄出重設信。若站方只有 UUID，先查出 Email：

```sql
select id, email
from auth.users
where id = '貼上 Auth User UUID';
```

拿到 Email 後，可選擇：

1. 請 GM 到網站「管理登入」輸入該 Email，按「忘記密碼 / 寄重設信」。
2. 站方到 Supabase Dashboard 的 Authentication / Users 找到該使用者，使用 password recovery / reset password 相關動作。
3. 若要用程式代寄，請在可信任 server 或 Supabase Edge Function 使用 service role key 查詢使用者 Email，然後呼叫 `resetPasswordForEmail(email, { redirectTo: '正式網站網址' })`。不要把 service role key 放在前端。

## 通知信設定

### GM 帳號申請通知

前端的「申請GM帳號」會呼叫 Supabase Edge Function：

```text
gm-account-request
```

部署 Edge Function：

```bash
npx supabase functions deploy gm-account-request
```

設定必要 secrets：

```bash
npx supabase secrets set RESEND_API_KEY="填上 RESEND API KEY"
npx supabase secrets set RESEND_FROM_EMAIL="先用 onboarding@resend.dev"
npx supabase secrets set ADMIN_NOTIFY_EMAIL="填上註冊 RESEND 的 E-mail"
```

建議 `RESEND_FROM` 使用已在 Resend 驗證的網域。若寄信失敗，先檢查 Resend API key、寄件網域、寄件地址與 Supabase Edge Function logs。

### 玩家加團申請通知

玩家加團申請通知預設關閉。若要啟用：

1. 確認已部署 `join-request-notify` Edge Function。
2. 確認 Resend 三個 secrets 已設定。
3. 登入 admin 帳號。
4. 在側欄「通知設定」打開「玩家申請時寄信通知站方」。

部署 Edge Function：

```bash
npx supabase functions deploy join-request-notify
```

此 Function 會優先讀取 Supabase 新 API key 架構提供的 `SUPABASE_SECRET_KEYS` JSON 物件中的 `default` secret key；若尚未遷移，仍會 fallback 到舊的 `SUPABASE_SERVICE_ROLE_KEY`。

專案中的 `supabase/config.toml` 已將兩個公開表單使用的 Function 設為 `verify_jwt = false`。這是因為訪客沒有登入 JWT，而新的 `sb_publishable_...` key 也不是 JWT；它不會放寬資料表的 RLS。兩個端點仍是公開入口，請保留前端 honeypot，並在正式站監看異常寄信量／必要時在網站前方加上 WAF 或 rate limit。

## Vercel 部署

### 環境變數

在 Vercel 專案設定 Environment Variables：

```text
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_PUBLISHABLE_KEY=sb_publishable_xxx
```

`SUPABASE_PUBLISHABLE_KEY` 會被前端載入，屬於公開 key；舊的 `SUPABASE_ANON_KEY` 仍可作為相容 fallback，但建議依 Supabase 新 API keys 指引改用 publishable key。安全性必須由 Supabase RLS policy、RPC 權限與 Edge Function secret 管理。

Edge Function 的新 key 不需要手動寫進 Vercel 或程式碼。Supabase 會在 Function 環境提供 `SUPABASE_SECRET_KEYS`；本專案只在 `join-request-notify` 讀取其 `default` key。新的 Secret key 在資料庫端使用 `service_role`，因此 schema 只授與它讀取通知流程所需的 `events`、`join_requests` 與 `app_settings`，不授與寫入權限。

### 建置指令

Vercel 部署時會執行：

```bash
node scripts/build-config.mjs
```

此指令會產生：

```text
public/config.js
```

讓前端知道 Supabase URL 與 publishable key（或相容 fallback 的 anon key）。

### 部署後檢查

1. 開啟正式網站，確認月曆可載入。
2. 使用 admin 帳號登入。
3. 建立一個測試團務。
4. 使用未登入視窗送出一筆測試加團申請。
5. 回到 admin / GM 視角確認申請可讀取與審核。
6. 測試「忘記密碼 / 寄重設信」是否可收到信並回到正式網站。
7. 測試 GM 帳號申請通知與玩家加團申請通知（若已啟用）。

## 資料庫與 RLS 維護

### 主要資料表

| 資料表 | 用途 |
| --- | --- |
| `public.admins` | 管理員名單。 |
| `public.gms` | GM 名單與顯示名稱。 |
| `public.events` | 團務資料。 |
| `public.join_requests` | 玩家加團申請。 |
| `public.event_private_notes` | GM 小筆記。 |
| `public.availability_polls` | 可跑團時間調查主檔。 |
| `public.availability_players` | 可跑團時間調查玩家與私人 token。 |
| `public.availability_slots` | 玩家可跑時段。 |
| `public.availability_poll_dates` | 指定日期模式使用的日期清單。 |
| `public.app_settings` | 站台設定，例如通知開關。 |

### RLS 原則摘要

- 訪客只能讀公開團務與新增加團申請。
- GM 可新增團務，但只能管理自己建立的團務與相關申請。
- 管理員可管理全部團務與申請。
- 玩家可跑團時間連結使用不可猜測 token，只能讀取與覆寫該玩家自己的可跑時段。
- service role key 不受 RLS 限制，必須只存在於可信任環境。
- 新的 Secret key 也會以 `service_role` 執行並繞過 RLS；它不是 Publishable key 的替代品，絕不能放入 `public/`、Vercel 前端環境變數或瀏覽器。
- `schema.sql` 先撤銷三個 Data API role 的既有 table/function 權限，再依需求重新授與；未來新增資料表或 RPC 時，必須同時新增最小化的 grant 與 RLS policy。

### 更新 schema

專案更新後，如 release notes 或 commit 說明要求更新資料庫，可再次在 SQL Editor 執行：

```sql
-- 貼上最新 supabase/schema.sql 後執行
```

執行前建議先備份資料庫，特別是正式站已有團務與申請資料時。

## 常見問題

### GM 收不到重設密碼信？

請依序檢查：

1. Email 是否正確。
2. 垃圾信與促銷信分類。
3. Supabase Authentication logs。
4. Supabase Auth rate limit 是否已達上限。
5. Site URL 與 Redirect URLs 是否正確。
6. 若使用 custom SMTP，檢查 SMTP / Resend / DNS 驗證狀態。

### publishable key 放在前端安全嗎？

publishable key 是 Supabase 新 API key 架構下給瀏覽器、手機與桌面 app 使用的公開前端 key；舊的 anon key 也屬於公開前端 key，但 Supabase 已建議改用 `sb_publishable_...`。資料安全不能依賴隱藏前端 key，而是依賴 RLS policy、資料庫 grant、RPC 權限與 Edge Function secrets。

### 什麼情況需要重跑 `supabase/schema.sql`？

當專案更新包含資料表、欄位、policy、RPC function 或 trigger 變更時，應重跑最新 schema。正式站重跑前請先備份資料。

## 參考文件

- Supabase Password Auth: https://supabase.com/docs/guides/auth/passwords
- Supabase JavaScript password reset: https://supabase.com/docs/reference/javascript/auth-resetpasswordforemail
- Supabase Redirect URLs: https://supabase.com/docs/guides/auth/redirect-urls
- Supabase Auth rate limits: https://supabase.com/docs/guides/auth/rate-limits
- Supabase Row Level Security: https://supabase.com/docs/guides/database/postgres/row-level-security
- Supabase Edge Functions secrets: https://supabase.com/docs/guides/functions/secrets
- Vercel Environment Variables: https://vercel.com/docs/projects/environment-variables
