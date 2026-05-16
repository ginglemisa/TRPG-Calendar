# 約團月曆

這是一個可部署到 Vercel 的靜態網站，使用 Supabase Auth + Postgres 保存團務與加團申請。

## 功能

- 電腦與手機瀏覽器都可使用的 Google Calendar 風格月曆 / 列表。
- 一般訪客可瀏覽公開團務、點開 Google Map / Line 連結、送出加團申請。
- 管理員使用 Supabase Email/Password 登入後，可新增、編輯、刪除團務。
- 管理員可查看申請名單，並將申請標記為待處理、核准或婉拒。
- 核准申請後，公開團務會自動更新已核准人數與剩餘名額。
- GM / 管理員可在單一團務建立「可跑團時間調查」，設定日期區間、產生玩家私人連結、查看提交進度、共通 / 多數可跑時段，並可清除整份調查。

## 本機預覽

本機沒有安裝 npm 也可以跑：

```powershell
node scripts/dev-server.mjs
```

然後打開：

```text
http://localhost:4173
```

若尚未設定 Supabase，畫面會使用本機示範資料。

## Supabase 設定

1. 到 Supabase 建立 project。
2. 在 SQL Editor 執行 `supabase/schema.sql`。
3. 到 Authentication 建立你的管理員 Email/Password 帳號。
4. 到 Authentication Users 複製該帳號的 `User UID`。
5. 在 SQL Editor 執行：

```sql
insert into public.admins (user_id, display_name)
values ('貼上你的 User UID', '管理員名稱');
```

若要建立 GM（可開團與管理自己團務）帳號，先在 Authentication 建立該帳號，再執行：

```sql
insert into public.gms (user_id, display_name)
values ('貼上 GM 的 User UID', 'GM 名稱');
```

Supabase 建議對公開 schema 啟用 Row Level Security；本專案的 schema 已啟用 RLS，並用 policy 限制：
- 訪客只能讀公開團務與新增申請。
- `admins` 可管理所有團務與申請。
- `gms` 可新增團務，且只能編輯/刪除自己 `owner_user_id` 的團務，也只能讀取/更新/刪除自己所屬團務的申請。
- 可跑團時間調查使用 `availability_polls`、`availability_players`、`availability_slots`，由 RPC 建立 / 讀取 / 清除。玩家私人連結只會透過不可猜測 token 讀取與覆蓋自己的可跑時段，不會讀到其他玩家或 GM 管理資料。

如果你已經建過資料表，之後更新本專案仍可再次執行 `supabase/schema.sql`。它會補上缺少欄位與觸發器，例如公開顯示剩餘名額需要的 `approved_players_count`。

## Vercel 部署

在 Vercel 專案設定 Environment Variables：

```text
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_ANON_KEY=your-public-anon-key
```

部署時 Vercel 會執行：

```text
node scripts/build-config.mjs
```

這會產生 `public/config.js`，讓前端連到你的 Supabase project。`SUPABASE_ANON_KEY` 是公開前端 key，安全性由 Supabase RLS policies 控制。

參考文件：

- Supabase Row Level Security: https://supabase.com/docs/guides/database/postgres/row-level-security
- Supabase Password Auth: https://supabase.com/docs/guides/auth/passwords
- Vercel Environment Variables: https://vercel.com/docs/projects/environment-variables
