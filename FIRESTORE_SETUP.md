# Firestore セットアップガイド

## チャット機能に必要なインデックス

チャット機能が正常に動作するためには、以下のFirestoreインデックスが必要です。

### chatMessages コレクション

1. **conversationId + createdAt (降順)**
   - コレクション: `chatMessages`
   - フィールド:
     - `conversationId` (昇順)
     - `createdAt` (降順)

2. **toUid + createdAt (降順)**
   - コレクション: `chatMessages`
   - フィールド:
     - `toUid` (昇順)
     - `createdAt` (降順)

3. **fromUid + createdAt (降順)**
   - コレクション: `chatMessages`
   - フィールド:
     - `fromUid` (昇順)
     - `createdAt` (降順)

## インデックスの作成方法

### 方法1: Firebase Console から作成

1. [Firebase Console](https://console.firebase.google.com/) にアクセス
2. プロジェクトを選択
3. 左メニューから「Firestore Database」を選択
4. 「インデックス」タブをクリック
5. 「複合インデックスを追加」をクリック
6. 上記のフィールドを追加

### 方法2: エラーメッセージから自動作成

アプリを実行してチャット機能を使用すると、コンソールにインデックス作成用のURLが表示されます。
そのURLをクリックすると、自動的にインデックスが作成されます。

## Firestore セキュリティルール

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // チャットメッセージ
    match /chatMessages/{messageId} {
      // 読み取り: conversationIdに含まれるユーザーのみ
      allow read: if request.auth != null && 
        (resource.data.fromUid == request.auth.uid || 
         resource.data.toUid == request.auth.uid);
      
      // 作成: 認証済みユーザーで、fromUidが自分のUID
      allow create: if request.auth != null && 
        request.resource.data.fromUid == request.auth.uid;
      
      // 更新・削除: 自分が送信したメッセージのみ
      allow update, delete: if request.auth != null && 
        resource.data.fromUid == request.auth.uid;
    }
  }
}
```

## トラブルシューティング

### 自分のメッセージが表示されない

1. **ブラウザのコンソールを確認**
   - F12キーを押して開発者ツールを開く
   - Consoleタブで「Subscribing to chat messages」のログを確認
   - 「Received messages」のログでメッセージ数を確認

2. **Firestoreのデータを直接確認**
   - Firebase Consoleで `chatMessages` コレクションを開く
   - `conversationId` が正しく設定されているか確認
   - `fromUid` と `toUid` が正しいか確認

3. **インデックスのステータスを確認**
   - Firebase Console > Firestore Database > インデックス
   - すべてのインデックスが「有効」になっているか確認

4. **セキュリティルールを確認**
   - Firebase Console > Firestore Database > ルール
   - 上記のルールが設定されているか確認

### メッセージが遅延して表示される

- Firestoreのリアルタイムリスナーが正常に動作しているか確認
- ネットワーク接続を確認
- ブラウザのキャッシュをクリア

## デバッグモード

開発中は、チャットページのコンソールログで以下の情報が表示されます：

- `Subscribing to chat messages`: サブスクリプション開始時
- `Received messages`: メッセージ受信時（件数と内容）
- `Sending message`: メッセージ送信時
- `Rendering message`: 各メッセージのレンダリング時

これらのログを確認することで、問題の原因を特定できます。
