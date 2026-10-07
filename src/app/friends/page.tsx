"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Users, UserPlus, MessageCircle, Trash2, Search, Copy, Check } from "lucide-react";
import { useStore } from "@/store/useStore";
import type { Friend, FriendRequest } from "@/types";
import { removeFriendFromFirestore, searchUsersForFriend, sendFriendRequest, subscribeOutgoingFriendRequests } from "@/lib/firestore/friends";
import { subscribeUsersOnlineStatus } from "@/lib/firestore/presence";
import { setProfileCheer } from "@/lib/firestore/profile";
import { sanitizeAvatar, sanitizeDisplayName } from "@/lib/identity";
import Dialog from "@/components/ui/Dialog";

function Avatar({avatar}: {avatar:string}) {const safe=sanitizeAvatar(avatar);return safe.startsWith("http") || safe.startsWith("data:") ? <img src={safe} alt="" className="w-11 h-11 rounded-full object-cover" /> : <span className="more-nav-icon text-xl">{safe}</span>;}
export default function FriendsPage() {
  const friends=useStore((state)=>state.friends);const profile=useStore((state)=>state.userProfile);
  const [query,setQuery]=useState("");const [copied,setCopied]=useState(false);
  const [results,setResults]=useState<{key:string;rows:Array<Omit<Friend,"addedAt">>;failed:boolean}|null>(null);
  const [retry,setRetry]=useState(0);const [outgoing,setOutgoing]=useState<FriendRequest[]>([]);
  const [online,setOnline]=useState<Set<string>>(new Set());const [pending,setPending]=useState<string|null>(null);
  const [remove,setRemove]=useState<Friend|null>(null);const [removing,setRemoving]=useState(false);
  const [feedback,setFeedback]=useState("");const [error,setError]=useState("");
  const [cheering,setCheering]=useState(false);
  const keyword=query.trim();const friendIds=friends.map((friend)=>friend.uid).join(",");const searchKey=`${profile.uid}:${friendIds}:${keyword}:${retry}`;
  useEffect(()=>{if(!profile.uid)return;return subscribeOutgoingFriendRequests(profile.uid,setOutgoing);},[profile.uid]);
  useEffect(()=>{if(!friendIds)return;return subscribeUsersOnlineStatus(friendIds.split(","),setOnline);},[friendIds]);
  useEffect(()=>{
    if(!keyword || !profile.uid)return;
    let disposed=false;const timer=window.setTimeout(()=>{
      void searchUsersForFriend(keyword,profile.uid,friendIds?friendIds.split(","):[]).then((rows)=>{if(!disposed)setResults({key:searchKey,rows,failed:false});}).catch(()=>{if(!disposed)setResults({key:searchKey,rows:[],failed:true});});
    },300);
    return()=>{disposed=true;window.clearTimeout(timer);};
  },[keyword,profile.uid,friendIds,searchKey]);
  const outgoingIds=useMemo(()=>new Set(outgoing.map((item)=>item.toUid)),[outgoing]);
  const onlineFriends=friends.filter((friend)=>online.has(friend.uid));
  const copy=async()=>{try{await navigator.clipboard.writeText(profile.uid);setCopied(true);setError("");}catch{setError("UIDをコピーできませんでした。表示されているIDを選択してコピーしてください。");}};
  const request=async(friend:Omit<Friend,"addedAt">)=>{if(pending || !profile.uid)return;setPending(friend.uid);setError("");setFeedback("");try{await sendFriendRequest({fromUid:profile.uid,fromName:profile.name,fromAvatar:profile.avatar,toUid:friend.uid});setFeedback(`${sanitizeDisplayName(friend.name)}さんに申請を送りました。`);setQuery("");}catch{setError("申請を送れませんでした。再試行してください。");}finally{setPending(null);}};
  const removeFriend=async()=>{if(!remove || removing)return;setRemoving(true);setError("");try{await removeFriendFromFirestore(profile.uid,remove.uid);setFeedback("フレンドを解除しました。");setRemove(null);}catch{setError("解除できませんでした。再試行してください。");}finally{setRemoving(false);}};
  const cheer=async()=>{if(!profile.uid || cheering || !onlineFriends.length)return;setCheering(true);setError("");setFeedback("");try{const outcomes=await Promise.allSettled(onlineFriends.map((friend)=>setProfileCheer(friend.uid,profile.uid,true)));const sent=outcomes.filter((item)=>item.status==="fulfilled").length;if(sent)setFeedback(`${sent}人に応援を送りました。`);if(sent!==outcomes.length)setError("一部の応援を送れませんでした。時間をおいて再試行してください。");}finally{setCheering(false);}};
  return <div className="max-w-3xl mx-auto space-y-5">
    <div className="page-heading"><div><h1>フレンド</h1><p>名前やUIDから、学習仲間を見つけましょう。</p></div><Link href="/conversations" className="secondary-button"><MessageCircle size={18} />メッセージ</Link></div>
    <div className="glass-card p-4 flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs text-muted">あなたのUID</p><p className="font-mono text-xl font-bold select-all break-all">{profile.uid || "確認中…"}</p></div><button disabled={!profile.uid} className="secondary-button" onClick={()=>void copy()}>{copied?<Check size={18} />:<Copy size={18} />}{copied?"コピー済み":"UIDをコピー"}</button></div>
    {feedback && <p role="status" className="text-sm">{feedback}</p>}{error && !remove && <p role="alert" className="text-sm text-danger">{error}</p>}
    <section className="glass-card p-4 space-y-4" aria-label="フレンド検索"><label className="inbox-search"><Search size={20} aria-hidden="true" /><input aria-label="名前またはUIDでフレンドを検索" placeholder="名前またはUIDで検索" value={query} onChange={(event)=>setQuery(event.target.value)} /></label>
      {keyword && (results?.key!==searchKey?<p role="status" className="text-sm text-muted py-3">ユーザーを検索中…</p>:results.failed?<div className="space-y-3"><p role="alert" className="text-sm text-danger">検索できませんでした。</p><button className="secondary-button" onClick={()=>setRetry((value)=>value+1)}>再検索</button></div>:results.rows.length===0?<p className="text-sm text-muted py-3">「{keyword}」に一致するユーザーが見つかりません。</p>:results.rows.map((friend)=><div key={friend.uid} className="inbox-row px-0"><Link href={`/profile/${friend.uid}`} aria-label={`${sanitizeDisplayName(friend.name)}のプロフィール`}><Avatar avatar={friend.avatar} /></Link><Link className="flex-1 min-w-0" href={`/profile/${friend.uid}`}><span className="block font-semibold truncate">{sanitizeDisplayName(friend.name)}</span><span className="block text-xs text-muted font-mono">{friend.uid}</span></Link><button className="primary-button" disabled={Boolean(pending)||outgoingIds.has(friend.uid)} onClick={()=>void request(friend)}><UserPlus size={18} />{pending===friend.uid?"送信中…":outgoingIds.has(friend.uid)?"申請中":"申請"}</button></div>))}
    </section>
    <section className="glass-card overflow-hidden"><div className="p-4 flex flex-wrap justify-between items-center gap-3 border-b" style={{borderColor:"var(--card-border)"}}><h2 className="text-lg font-bold">フレンド <span className="text-sm text-muted">{friends.length}人</span></h2><button className="secondary-button" disabled={cheering || !onlineFriends.length} onClick={()=>void cheer()}>{cheering?"送信中…":`オンラインの仲間を応援 (${onlineFriends.length})`}</button></div>{friends.length===0?<div className="list-empty"><Users size={32} /><h2>フレンドがまだいません</h2><p>上の検索欄から、仲間に申請を送ってみましょう。</p></div>:friends.map((friend)=><div key={friend.uid} className="inbox-row flex-wrap sm:flex-nowrap"><Link href={`/profile/${friend.uid}`} aria-label={`${sanitizeDisplayName(friend.name)}のプロフィール`}><Avatar avatar={friend.avatar} /></Link><Link href={`/profile/${friend.uid}`} className="flex-1 min-w-0"><span className="block font-semibold truncate">{sanitizeDisplayName(friend.name)}</span><span className="block text-sm text-muted">{online.has(friend.uid)?"オンライン":"オフライン"}</span></Link><div className="flex gap-1"><Link className="icon-button" href={`/friends/chat/${friend.uid}`} aria-label={`${sanitizeDisplayName(friend.name)}にメッセージ`}><MessageCircle size={20} /></Link><button className="icon-button" onClick={()=>{setError("");setRemove(friend);}} aria-label={`${sanitizeDisplayName(friend.name)}とのフレンドを解除`}><Trash2 size={20} /></button></div></div>)}</section>
    <Dialog open={Boolean(remove)} onClose={()=>{if(!removing)setRemove(null);}} title="フレンドを解除"><div className="space-y-4"><p>「{sanitizeDisplayName(remove?.name)}」さんとのフレンド関係を解除します。</p>{error && <p role="alert" className="text-sm text-danger">{error}</p>}<div className="flex flex-wrap gap-2"><button className="secondary-button" disabled={removing} onClick={()=>setRemove(null)}>キャンセル</button><button className="primary-button" disabled={removing} onClick={()=>void removeFriend()}>{removing?"解除中…":"解除する"}</button></div></div></Dialog>
  </div>;
}
