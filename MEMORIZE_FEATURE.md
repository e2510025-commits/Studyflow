# 暗記機能 - StudyFlow

## 概要

StudyFlowに統合された暗記機能は、フラッシュカードと穴埋め問題の2つの学習モードを提供します。

## 主な機能

### 1. フラッシュカード（デッキ管理）

#### デッキ作成
- `/memorize/create-deck` - 新しいデッキを作成
- デッキ名、説明、カラー、公開設定を指定可能

#### カード管理
- 問題面（front）と解答面（back）を設定
- ヒント機能付き
- カードステータス: 未学習 / 学習中 / 習得済み

#### 復習システム（SM-2アルゴリズム）
- 忘却曲線に基づく最適な復習タイミング
- 4段階評価: 忘れた / 難しい / 普通 / 簡単
- 自動的に次回復習日を計算

#### 復習モード
- `/memorize/review/[deckId]` - 復習セッション
- スペースキーで反転
- 数字キー（1-4）で評価
- 音声読み上げ機能（ブラウザのSpeech Synthesis API）
- ヒント表示機能

### 2. 穴埋め問題

#### 問題作成エディタ
- `/memorize/create-question` - 新しい問題を作成
- 常設「（ ）」ボタン: テキスト選択 → ボタンクリックで瞬時に穴埋め化
- リアルタイムプレビュー: 作成中の問題を即座に確認
- {{答え}}形式で複数の穴埋めを設定可能

#### 解答モード
- 順次解答モード: 1つずつ解答してEnterで次へ
- 一括解答モード: すべて入力してから判定

#### テストモード
- `/memorize/test/[questionId]` - 問題に挑戦
- 動的リサイズ入力フィールド: 答えの長さに応じて自動調整
- オートタブ: Enterキーで次の入力欄へ自動移動
- 柔軟な判定: 全角・半角、スペース、カッコの違いを自動吸収
- ヒント機能: 最初の1文字を表示
- 部分正解表示: どこが間違っているか明示

### 3. ナビゲーション統合

#### サイドバーバッジ
- 「暗記」メニューに今日の復習枚数をリアルタイム表示
- 1分ごとに自動更新

#### ダッシュボード
- `/memorize` - 暗記機能のホーム
- 統計表示: 総カード数、復習待ち、習得済み
- デッキ一覧と問題一覧へのアクセス

## データ構造（Firestore）

### コレクション

#### memoryDecks
```typescript
{
  uid: string;
  name: string;
  description: string;
  color: string;
  isPublic: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

#### flashCards
```typescript
{
  uid: string;
  deckId: string;
  front: string;
  back: string;
  hint: string;
  status: "new" | "learning" | "mastered";
  nextReviewAt: Timestamp;
  easeFactor: number;
  interval: number;
  repetitions: number;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

#### cardReviews
```typescript
{
  uid: string;
  cardId: string;
  rating: number; // 1-4
  duration: number; // 秒
  createdAt: Timestamp;
}
```

#### fillInBlankQuestions
```typescript
{
  uid: string;
  title: string;
  content: string; // {{answer}}形式
  answers: string[];
  mode: "sequential" | "all-at-once";
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

#### questionAttempts
```typescript
{
  uid: string;
  questionId: string;
  userAnswers: string[];
  isCorrect: boolean;
  duration: number; // 秒
  createdAt: Timestamp;
}
```

## API エンドポイント

### デッキ管理
- `GET /api/memorize/decks` - デッキ一覧取得
- `POST /api/memorize/decks` - デッキ作成
- `GET /api/memorize/decks/[id]` - デッキ詳細取得

### カード管理
- `POST /api/memorize/cards` - カード作成
- `GET /api/memorize/review/[deckId]` - 復習対象カード取得
- `POST /api/memorize/review` - 復習結果保存

### 問題管理
- `GET /api/memorize/questions` - 問題一覧取得
- `POST /api/memorize/questions` - 問題作成
- `GET /api/memorize/questions/[id]` - 問題詳細取得
- `POST /api/memorize/attempts` - 解答結果保存

## 使用技術

- Next.js 16 (App Router)
- TypeScript
- Firestore (Firebase)
- Framer Motion (アニメーション)
- Lucide React (アイコン)
- SM-2アルゴリズム (間隔反復学習)

## 今後の拡張予定

- [ ] LaTeX数式対応
- [ ] 画像添付機能
- [ ] CSV一括インポート
- [ ] グループ共有機能
- [ ] AIヒント生成（Gemini連携）
- [ ] 学習統計ダッシュボード
- [ ] ヒートマップ表示
- [ ] タイマー連動（暗記モード自動記録）
