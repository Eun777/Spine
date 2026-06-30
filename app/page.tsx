"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { deleteLocalBook, getLocalBooks, updateLocalBook } from "@/lib/local-books";
import type { Book } from "@/lib/types";

function BookCard({book,onEdit,onDelete,onEnrich}:{book:Book;onEdit:()=>void;onDelete:()=>void;onEnrich:()=>void}) {
  const nlbUrl=`https://search.nlb.gov.sg/onesearch/Search?${new URLSearchParams({query:`${book.title} ${book.author}`.trim(),cont:"book"})}`;
  const facts=[book.published_date,book.page_count?`${book.page_count} pages`:null,book.language?.toUpperCase()].filter(Boolean);
  return <article className={`book-card ${book.cover_image_url?"has-cover":""}`}>
    <span className="genre">{book.genre||book.categories?.[0]||"Unclassified"}</span>
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
  const [books,setBooks]=useState<Book[]>([]), [query,setQuery]=useState(""), [genre,setGenre]=useState("All genres");
  const [editing,setEditing]=useState<Book|null>(null), [toast,setToast]=useState(""), [storage,setStorage]=useState<"local"|"supabase">("local");
  useEffect(()=>{fetch("/api/books").then(r=>r.json()).then(data=>{if(data.storage==="supabase"){setStorage("supabase");setBooks(data.books)}else setBooks(getLocalBooks())}).catch(()=>setBooks(getLocalBooks()))},[]);
  const genres=useMemo(()=>["All genres",...Array.from(new Set(books.map(b=>b.genre).filter(Boolean) as string[])).sort()], [books]);
  const shown=books.filter(b=>{
    const q=query.toLowerCase(); return (!q || [b.title,b.author,b.genre||""].some(v=>v.toLowerCase().includes(q))) && (genre==="All genres" || b.genre===genre);
  });
  async function remove(id:string){ if(confirm("Remove this book from your library?")){if(storage==="supabase"){const r=await fetch(`/api/books/${id}`,{method:"DELETE"});if(!r.ok){setToast("Could not remove that book");return}setBooks(v=>v.filter(b=>b.id!==id))}else setBooks(deleteLocalBook(id));setToast("Book removed");setTimeout(()=>setToast(""),2200)} }
  async function saveEdit(){if(!editing?.title.trim())return;if(storage==="supabase"){const r=await fetch(`/api/books/${editing.id}`,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify(editing)});if(!r.ok){setToast("Could not save changes");return}const data=await r.json();setBooks(v=>v.map(b=>b.id===editing.id?data.book:b))}else setBooks(updateLocalBook(editing.id,editing));setEditing(null);setToast("Changes saved");setTimeout(()=>setToast(""),2200)}
  async function enrichBook(book:Book){setToast("Looking up book details…");try{const r=await fetch("/api/book-metadata",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({books:[book]})});if(!r.ok)throw new Error();const enriched=(await r.json()).books?.[0];if(!enriched?.metadata_source){setToast("No additional details found");return}if(storage==="supabase"){const saved=await fetch(`/api/books/${book.id}`,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify(enriched)});if(!saved.ok)throw new Error();const data=await saved.json();setBooks(v=>v.map(b=>b.id===book.id?data.book:b))}else setBooks(updateLocalBook(book.id,enriched));setToast("Book details added")}catch{setToast("Could not find details right now")}finally{setTimeout(()=>setToast(""),2400)}}
  return <section className="shell">
    <div className="library-head"><div><p className="eyebrow">Your personal collection</p><h1>My library</h1><p className="lede">Every shelf tells a story. Keep yours close.</p></div><span className="collection-count">{books.length} {books.length===1?"book":"books"}</span></div>
    {books.length>0 && <div className="tools"><label className="field-shell"><span aria-hidden="true">⌕</span><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search title, author, or genre…" aria-label="Search books" /></label><label className="field-shell"><select value={genre} onChange={e=>setGenre(e.target.value)} aria-label="Filter by genre">{genres.map(g=><option key={g}>{g}</option>)}</select></label></div>}
    {books.length===0 ? <div className="empty"><div className="empty-icon">⌁</div><h2>Your shelves are waiting</h2><p>Scan a cover or a whole stack to begin your collection.</p><Link className="primary" href="/scan">Scan your first books</Link></div> : shown.length===0 ? <div className="empty"><h2>No matching books</h2><p>Try a different search or genre.</p><button className="secondary" onClick={()=>{setQuery("");setGenre("All genres")}}>Clear filters</button></div> : <div className="book-grid">{shown.map(book=><BookCard key={book.id} book={book} onEdit={()=>setEditing(book)} onDelete={()=>remove(book.id)} onEnrich={()=>enrichBook(book)} />)}</div>}
    {editing&&<div className="modal-backdrop" onMouseDown={e=>{if(e.currentTarget===e.target)setEditing(null)}}><div className="modal" role="dialog" aria-modal="true" aria-label="Edit book"><h2>Edit book</h2><div className="form-grid">{(["title","author","isbn","genre"] as const).map(key=><label key={key}>{key.toUpperCase()}<input value={editing[key]||""} onChange={e=>setEditing({...editing,[key]:e.target.value})}/></label>)}</div><div className="modal-actions"><button className="secondary" onClick={()=>setEditing(null)}>Cancel</button><button className="primary" onClick={saveEdit}>Save changes</button></div></div></div>}
    {toast&&<div className="toast" role="status">{toast}</div>}
  </section>;
}
