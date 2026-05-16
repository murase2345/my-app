

\# SPEC\_v4.md



\## 1. 概要

本アプリは英単語学習を中心とした学習管理システムであり、以下の機能を提供する。



\- 単語学習（4択・フラッシュ・リスニング）

\- 学習ログ・統計管理

\- 参考書・単語帳管理

\- 週間学習スケジュール

\- 通知機能

\- ユーザー管理（roleベース）



\---



\## 2. ユーザー種別



| role | 説明 |

|------|------|

| user | 生徒 |

| teacher | 講師 |

| manager | 教務 |

| admin | 管理者 |



\### 権限

\- admin / manager：全参考書利用可能

\- user / teacher：申請ベースで利用



\---



\## 3. データ構造（Dexie DB）



\### 3.1 users

\- userId

\- role

\- school\[]

\- email

\- isActive



\### 3.2 userSettings

\- defaultMode

\- defaultQuestionType

\- defaultTimeLimitSec

\- audioAutoplay

\- audioVolume（0〜3.0）

\- audioRate

\- dailyGoalMin

\- notificationGlobalOff



\### 3.3 books / chapters / words

\- books: bookId, title

\- chapters: chapterId, bookId

\- wordEntries: wordId, bookId, chapterId, bookNo



\### 3.4 学習系

\- answerLogs

\- studySessions

\- activityEvents



\#### 学習時間計算

\- activityEvents差分で算出

\- 2分以上の無操作は切り捨て



\---



\## 4. 学習機能



\### 4.1 出題形式

\- FLASH

\- MULTI

\- LISTEN\_FLASH

\- LISTEN\_MULTI



\### 4.2 モード

\- EN\_JA（英→日）

\- JA\_EN（日→英）



\### 4.3 誤答生成

\- 同一参考書優先

\- chapter差が近い単語を使用



\---



\## 5. スケジュール機能



\### 5.1 scheduleGroups

\- 期間単位の計画



\### 5.2 schedules

\- 日別データ

\- dayType:

&#x20; - study

&#x20; - review

&#x20; - test

&#x20; - fullReview

&#x20; - rest



\### 5.3 自動生成ロジック

\- ペース設定

&#x20; - 4-2

&#x20; - 2-1

&#x20; - N-M

&#x20; - N\_step

&#x20; - daily

&#x20; - manual



\### 5.4 範囲計算

\- study:

&#x20; - startIndex から dailyCount 分増加

\- review:

&#x20; - 直前のstudy範囲

\- fullReview:

&#x20; - 全範囲



\---



\## 6. 通知



\### 6.1 notifications

\- content

\- type

\- isRead

\- metaJson



\### 6.2 挙動

\- 未読数カウント

\- 表示時に自動既読化

\- 個別ON/OFF対応



\---



\## 7. 参考書申請



\### フロー

1\. user/teacher が申請

2\. teacher / manager が承認

3\. userBookAccess付与



\### 制限

\- teacher申請 → manager/adminのみ承認可



\---



\## 8. UI仕様



\### タブ構成

\- ホーム

\- 学習

\- 参考書

\- プレイリスト

\- 単語帳

\- 自作単語帳

\- 統計

\- 設定

\- 通知

\- 予定

\- 管理（権限者のみ）



\### 通知バッジ

\- 未読がある場合赤ドット表示



\---



\## 9. ホーム画面表示順



1\. 未読通知

2\. 本日の予定

3\. 進捗（問題数）

4\. 勉強時間（目標比較）

5\. 今週予定

6\. クイック開始



\---



\## 10. 設定



\### 編集可能

\- 音量（0.0〜3.0）

\- メールアドレス



\### 管理者機能

\- school変更



\---



\## 11. セキュリティ



\- APIキーなど保存禁止

\- email空欄許可

\- roleベースアクセス制御



\---



\## 12. 特記事項



\- 初期DBはseedから生成

\- adminは全参考書アクセス

\- 学習ログはバッファリング保存（20件単位）



\---



\## 13. 今後拡張予定



\- プレイリスト機能

\- 自作単語帳詳細機能

\- 分析強化



