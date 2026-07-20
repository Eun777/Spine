"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { nlbSearchUrl } from "@/lib/book-utils";
import { deleteLocalBook, getLocalBooks, updateLocalBook } from "@/lib/local-books";
import { BOOK_STATUSES, BOOK_STATUS_LABELS, type Book, type BookStatus } from "@/lib/types";

function receiptText(books:Book[],owner:string){
  const date=new Intl.DateTimeFormat("en-SG",{dateStyle:"long"}).format(new Date());
  return [`SPINE BOOK WISHLIST`,owner?`A gift list for ${owner}`:"A bookish gift list",date,"",...books.map((book,i)=>`${String(i+1).padStart(2,"0")}  ${book.title}${book.author?` — ${book.author}`:""}`),"",`${books.length} ${books.length===1?"BOOK":"BOOKS"}`,"Thank you for making my shelf happier!"] .join("\n");
}

function makeReceiptImage(books:Book[],owner:string):Promise<Blob>{
  return new Promise((resolve,reject)=>{
    const width=900,row=74,header=330,footer=300,height=header+books.length*row+footer;
    const canvas=document.createElement("canvas");canvas.width=width;canvas.height=height;
    const ctx=canvas.getContext("2d");if(!ctx)return reject(new Error("Canvas unavailable"));
    ctx.fillStyle="#f8f4e9";ctx.fillRect(0,0,width,height);ctx.fillStyle="#222";ctx.textBaseline="top";
    const center=(text:string,y:number,font:string)=>{ctx.font=font;ctx.textAlign="center";ctx.fillText(text,width/2,y)};
    const line=(y:number)=>{ctx.strokeStyle="#555";ctx.setLineDash([8,8]);ctx.beginPath();ctx.moveTo(55,y);ctx.lineTo(width-55,y);ctx.stroke()};
    center("SPINE",55,"700 76px Georgia");center("BOOK WISHLIST",145,"32px monospace");
    ctx.font="25px monospace";ctx.textAlign="left";ctx.fillText(owner?`FOR: ${owner.toUpperCase()}`:"A VERY BOOKISH WISHLIST",58,220);ctx.fillText(new Intl.DateTimeFormat("en-SG",{dateStyle:"long"}).format(new Date()).toUpperCase(),58,260);line(305);
    ctx.font="22px monospace";ctx.fillText("QTY  ITEM",58,325);ctx.textAlign="right";ctx.fillText("AUTHOR",842,325);line(360);
    books.forEach((book,i)=>{const y=385+i*row;ctx.textAlign="left";ctx.font="25px monospace";ctx.fillText(String(i+1).padStart(2,"0"),58,y);ctx.font="700 25px monospace";ctx.fillText(book.title.length>35?`${book.title.slice(0,34)}…`:book.title,130,y);ctx.font="19px monospace";ctx.fillStyle="#666";ctx.fillText((book.author||"Unknown author").slice(0,48),130,y+34);ctx.fillStyle="#222"});
    const bottom=385+books.length*row;line(bottom);ctx.font="25px monospace";ctx.textAlign="left";ctx.fillText("ITEM COUNT:",58,bottom+28);ctx.textAlign="right";ctx.fillText(String(books.length),842,bottom+28);line(bottom+78);
    center("THANK YOU FOR FEEDING MY TBR!",bottom+115,"24px monospace");
    ctx.fillStyle="#222";for(let x=215;x<685;x+=Math.floor(Math.random()*7)+5)ctx.fillRect(x,bottom+170,Math.floor(Math.random()*5)+2,75);
    center("spine · my book wishlist",bottom+255,"20px monospace");canvas.toBlob(blob=>blob?resolve(blob):reject(new Error("Could not create receipt")),"image/png");
  });
}

function BookCard({book,onEdit,onDelete,onEnrich,onStatusChange}:{book:Book;onEdit:()=>void;onDelete:()=>void;onEnrich:()=>void;onStatusChange:(status:BookStatus)=>void}) {
  const nlbUrl=nlbSearchUrl(book);
  const facts=[book.published_date,book.page_count?`${book.page_count} pages`:null,book.language?.toUpperCase()].filter(Boolean);
  return <article className={`book-card ${book.cover_image_url?"has-cover":""}`}>
    <div className="card-labels"><span className="genre">{book.genre||book.categories?.[0]||"Unclassified"}</span><label className={`status-control status-${book.status||"wishlist"}`}><span className="sr-only">Reading status</span><select aria-label={`Status for ${book.title}`} value={book.status||"wishlist"} onChange={e=>onStatusChange(e.target.value as BookStatus)}>{BOOK_STATUSES.map(status=><option value={status} key={status}>{BOOK_STATUS_LABELS[status]}</option>)}</select></label></div>
    <div className="card-actions"><button className="icon-btn" aria-label={`Edit ${book.title}`} onClick={onEdit}>✎</button><button className="icon-btn" aria-label={`Delete ${book.title}`} onClick={onDelete}>⌫</button></div>
    {book.cover_image_url&&<img className="book-cover" src={book.cover_image_url} alt={`Cover of ${book.title}`} />}
    <h2>{book.title}</h2><p className="author">by {book.author||"Unknown author"}</p>
    {book.description&&<p className="book-description">{book.description}</p>}
    {facts.length>0&&<p className="book-facts">{facts.join(" · ")}</p>}
    {book.average_rating&&<p className="book-rating"><span>★</span> {book.average_rating.toFixed(1)}{book.ratings_count?` (${book.ratings_count.toLocaleString()})`:""}</p>}
    {book.isbn&&<span className="isbn">ISBN {book.isbn}</span>}
    <div className="book-links">{book.preview_url?<a href={book.preview_url} target="_blank" rel="noopener noreferrer">Book details ↗</a>:<button onClick={onEnrich}>Add details ＋</button>}<a href={nlbUrl} target="_blank" rel="noopener noreferrer">Find at NLB ↗</a></div>
  </article>;
}

export default function HomePage() {
  const [books,setBooks]=useState<Book[]>([]), [query,setQuery]=useState(""), [genre,setGenre]=useState("All genres"), [statusFilter,setStatusFilter]=useState("All statuses");
  const [editing,setEditing]=useState<Book|null>(null), [toast,setToast]=useState(""), [storage,setStorage]=useState<"local"|"supabase">("local");
  const [showReceipt,setShowReceipt]=useState(false), [receiptName,setReceiptName]=useState(""), [sharing,setSharing]=useState(false);
  useEffect(()=>{fetch("/api/books").then(r=>r.json()).then(data=>{if(data.storage==="supabase"){setStorage("supabase");setBooks(data.books)}else setBooks(getLocalBooks())}).catch(()=>setBooks(getLocalBooks()))},[]);
  const genres=useMemo(()=>["All genres",...Array.from(new Set(books.map(b=>b.genre).filter(Boolean) as string[])).sort()], [books]);
  const shown=books.filter(b=>{
    const q=query.toLowerCase(); return (!q || [b.title,b.author,b.genre||""].some(v=>v.toLowerCase().includes(q))) && (genre==="All genres" || b.genre===genre) && (statusFilter==="All statuses" || (b.status||"wishlist")===statusFilter);
  });
  const wishlist=books.filter(book=>(book.status||"wishlist")==="wishlist");
  async function shareReceipt(){
    setSharing(true);try{const blob=await makeReceiptImage(wishlist,receiptName.trim());const file=new File([blob],"book-wishlist-receipt.png",{type:"image/png"});const data={title:"My book wishlist",text:receiptText(wishlist,receiptName.trim()),files:[file]};if(navigator.share&&navigator.canShare?.({files:[file]})){await navigator.share(data)}else{const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download=file.name;a.click();URL.revokeObjectURL(url);setToast("Receipt image saved — attach it to your message")}}catch(error){if(error instanceof Error&&error.name!=="AbortError")setToast("Could not share the receipt")}finally{setSharing(false);setTimeout(()=>setToast(""),2600)}
  }
  async function copyReceipt(){try{await navigator.clipboard.writeText(receiptText(wishlist,receiptName.trim()));setToast("Wishlist copied — paste it into any chat")}catch{setToast("Could not copy the wishlist")}finally{setTimeout(()=>setToast(""),2400)}}
  async function remove(id:string){ if(confirm("Remove this book from your library?")){if(storage==="supabase"){const r=await fetch(`/api/books/${id}`,{method:"DELETE"});if(!r.ok){setToast("Could not remove that book");return}setBooks(v=>v.filter(b=>b.id!==id))}else setBooks(deleteLocalBook(id));setToast("Book removed");setTimeout(()=>setToast(""),2200)} }
  async function saveEdit(){if(!editing?.title.trim())return;if(storage==="supabase"){const r=await fetch(`/api/books/${editing.id}`,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify(editing)});if(!r.ok){setToast("Could not save changes");return}const data=await r.json();setBooks(v=>v.map(b=>b.id===editing.id?data.book:b))}else setBooks(updateLocalBook(editing.id,editing));setEditing(null);setToast("Changes saved");setTimeout(()=>setToast(""),2200)}
  async function enrichBook(book:Book){setToast("Looking up book details…");try{const r=await fetch("/api/book-metadata",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({books:[book]})});if(!r.ok)throw new Error();const enriched=(await r.json()).books?.[0];if(!enriched?.metadata_source){setToast("No additional details found");return}if(storage==="supabase"){const saved=await fetch(`/api/books/${book.id}`,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify(enriched)});if(!saved.ok)throw new Error();const data=await saved.json();setBooks(v=>v.map(b=>b.id===book.id?data.book:b))}else setBooks(updateLocalBook(book.id,enriched));setToast("Book details added")}catch{setToast("Could not find details right now")}finally{setTimeout(()=>setToast(""),2400)}}
  async function changeStatus(book:Book,status:BookStatus){const previous=book.status||"wishlist";setBooks(v=>v.map(b=>b.id===book.id?{...b,status}:b));try{if(storage==="supabase"){const response=await fetch(`/api/books/${book.id}`,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({status})});if(!response.ok)throw new Error()}else setBooks(updateLocalBook(book.id,{status}));setToast(`Moved to ${BOOK_STATUS_LABELS[status]}`)}catch{setBooks(v=>v.map(b=>b.id===book.id?{...b,status:previous}:b));setToast("Could not update reading status")}finally{setTimeout(()=>setToast(""),2200)}}
  return <section className="shell">
    <div className="library-head"><div><p className="eyebrow">Your personal collection</p><h1>My library</h1><p className="lede">Every shelf tells a story. Keep yours close.</p></div><div className="library-summary">{wishlist.length>0&&<button className="receipt-button" onClick={()=>setShowReceipt(true)}>▤ Share wishlist</button>}<span className="collection-count">{books.length} {books.length===1?"book":"books"}</span></div></div>
    {books.length>0 && <div className="tools"><label className="field-shell"><span aria-hidden="true">⌕</span><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search title, author, or genre…" aria-label="Search books" /></label><label className="field-shell"><select value={genre} onChange={e=>setGenre(e.target.value)} aria-label="Filter by genre">{genres.map(g=><option key={g}>{g}</option>)}</select></label><label className="field-shell"><select value={statusFilter} onChange={e=>setStatusFilter(e.target.value)} aria-label="Filter by reading status"><option>All statuses</option>{BOOK_STATUSES.map(status=><option value={status} key={status}>{BOOK_STATUS_LABELS[status]}</option>)}</select></label></div>}
    {books.length===0 ? <div className="empty"><div className="empty-icon">⌁</div><h2>Your shelves are waiting</h2><p>Scan a cover or a whole stack to begin your collection.</p><Link className="primary" href="/scan">Scan your first books</Link></div> : shown.length===0 ? <div className="empty"><h2>No matching books</h2><p>Try a different search, genre, or status.</p><button className="secondary" onClick={()=>{setQuery("");setGenre("All genres");setStatusFilter("All statuses")}}>Clear filters</button></div> : <div className="book-grid">{shown.map(book=><BookCard key={book.id} book={book} onEdit={()=>setEditing(book)} onDelete={()=>remove(book.id)} onEnrich={()=>enrichBook(book)} onStatusChange={status=>changeStatus(book,status)} />)}</div>}
    {editing&&<div className="modal-backdrop" onMouseDown={e=>{if(e.currentTarget===e.target)setEditing(null)}}><div className="modal" role="dialog" aria-modal="true" aria-label="Edit book"><h2>Edit book</h2><div className="form-grid">{(["title","author","isbn","genre"] as const).map(key=><label key={key}>{key.toUpperCase()}<input value={editing[key]||""} onChange={e=>setEditing({...editing,[key]:e.target.value})}/></label>)}<label>STATUS<select value={editing.status||"wishlist"} onChange={e=>setEditing({...editing,status:e.target.value as BookStatus})}>{BOOK_STATUSES.map(status=><option value={status} key={status}>{BOOK_STATUS_LABELS[status]}</option>)}</select></label></div><div className="modal-actions"><button className="secondary" onClick={()=>setEditing(null)}>Cancel</button><button className="primary" onClick={saveEdit}>Save changes</button></div></div></div>}
    {showReceipt&&<div className="modal-backdrop receipt-backdrop" onMouseDown={e=>{if(e.currentTarget===e.target)setShowReceipt(false)}}><div className="receipt-dialog" role="dialog" aria-modal="true" aria-label="Share book wishlist"><div className="receipt-controls"><div><p className="eyebrow">Ready to gift</p><h2>Share your wishlist</h2></div><button className="icon-btn close-receipt" aria-label="Close" onClick={()=>setShowReceipt(false)}>✕</button><label>Your name (optional)<input value={receiptName} onChange={e=>setReceiptName(e.target.value)} placeholder="e.g. Jamie" maxLength={40}/></label></div><div className="receipt-paper"><h3>SPINE</h3><p className="receipt-subtitle">BOOK WISHLIST</p><div className="receipt-meta"><span>{receiptName.trim()?`FOR ${receiptName.trim().toUpperCase()}`:"A VERY BOOKISH WISHLIST"}</span><span>{new Intl.DateTimeFormat("en-SG",{dateStyle:"long"}).format(new Date()).toUpperCase()}</span></div><div className="receipt-rule"/><div className="receipt-row receipt-heading"><span>QTY</span><span>ITEM</span></div>{wishlist.map((book,i)=><div className="receipt-row receipt-item" key={book.id}><span>{String(i+1).padStart(2,"0")}</span><span><strong>{book.title}</strong><small>{book.author||"Unknown author"}</small></span></div>)}<div className="receipt-rule"/><div className="receipt-total"><span>ITEM COUNT:</span><strong>{wishlist.length}</strong></div><div className="receipt-rule"/><p className="receipt-thanks">THANK YOU FOR FEEDING MY TBR!</p><div className="receipt-barcode" aria-hidden="true"/><p className="receipt-brand">spine · my book wishlist</p></div><div className="receipt-actions"><button className="secondary" onClick={copyReceipt}>Copy as text</button><button className="primary" disabled={sharing} onClick={shareReceipt}>{sharing?"Preparing…":"Send to a friend"}</button></div></div></div>}
    {toast&&<div className="toast" role="status">{toast}</div>}
  </section>;
}
