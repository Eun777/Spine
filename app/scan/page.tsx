"use client";

import { ChangeEvent, FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { BookDraft } from "@/lib/types";

const SAMPLE:BookDraft[]=[
  {title:"The Midnight Library",author:"Matt Haig",isbn:"9780525559498",genre:"Contemporary Fiction",confidence_score:.96},
  {title:"Braiding Sweetgrass",author:"Robin Wall Kimmerer",isbn:"9781571313560",genre:"Nature Writing",confidence_score:.91},
  {title:"Tomorrow, and Tomorrow, and Tomorrow",author:"Gabrielle Zevin",isbn:"9780593321201",genre:"Literary Fiction",confidence_score:.88}
];

export default function ScanPage(){
  const router=useRouter(); const [image,setImage]=useState<string|null>(null),[loading,setLoading]=useState(false),[error,setError]=useState("");
  const [access,setAccess]=useState<"loading"|"locked"|"unlocked"|"unconfigured">("loading"),[code,setCode]=useState(""),[codeError,setCodeError]=useState("");
  useEffect(()=>{fetch("/api/access/status").then(r=>r.json()).then(d=>setAccess(!d.configured?"unconfigured":d.unlocked?"unlocked":"locked")).catch(()=>setAccess("locked"))},[]);
  async function unlock(e:FormEvent){e.preventDefault();setCodeError("");const r=await fetch("/api/access/verify",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({code})});const data=await r.json();if(!r.ok){setCodeError(data.error||"Could not verify that code");return}setCode("");setAccess("unlocked")}
  function choose(e:ChangeEvent<HTMLInputElement>){const file=e.target.files?.[0];if(!file)return;if(file.size>12*1024*1024){setError("Please choose an image under 12 MB.");return}const reader=new FileReader();reader.onload=()=>{setImage(String(reader.result));setError("")};reader.readAsDataURL(file)}
  async function goReview(books:BookDraft[]){setLoading(true);try{const response=await fetch("/api/book-metadata",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({books})});if(response.ok){const data=await response.json();books=data.books||books}}catch{}finally{sessionStorage.setItem("detected-books",JSON.stringify(books));router.push("/review")}}
  async function scan(){if(!image)return;setLoading(true);setError("");try{const res=await fetch("/api/recognize-books",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({image})});const data=await res.json();if(!res.ok)throw new Error(data.error||"Scan failed");if(!data.books?.length)throw new Error("No books were detected. Try a clearer, closer photo.");await goReview(data.books)}catch(e){setError(e instanceof Error?e.message:"We couldn't scan that photo.")}finally{setLoading(false)}}
  if(access==="loading")return <div className="page-loader" aria-label="Loading"><span /></div>;
  if(access!=="unlocked")return <section className="shell scan-shell"><div className="access-card"><div className="lock-orb">⌁</div><p className="eyebrow">Protected feature</p><h1>Unlock book scanning</h1><p className="lede">AI scanning uses paid credits. Enter the private access code to continue.</p>{access==="unconfigured"?<p className="form-error">The owner has not configured an access code yet.</p>:<form className="access-form" onSubmit={unlock}><label>Access code<input type="password" autoComplete="off" required value={code} onChange={e=>setCode(e.target.value)} placeholder="Enter access code" /></label>{codeError&&<p className="form-error" role="alert">{codeError}</p>}<button className="primary">Unlock scanning</button></form>}</div></section>;
  return <section className="shell scan-shell"><p className="eyebrow">Add to your library</p><h1>What’s on your shelf?</h1><p className="lede">Snap a cover, a stack, or a whole row. We’ll find the books and fill in the details.</p>
    <div className="dropzone">{image?<><img className="preview" src={image} alt="Selected books"/><div className="button-row"><label className="secondary" htmlFor="book-image">Choose another</label><button className="primary" onClick={scan} disabled={loading}>{loading?<><span className="loader"/>Reading spines…</>:"Recognize books"}</button></div></>:<><div className="camera-orb">▣</div><h2>Take or choose a photo</h2><p>Clear covers and well-lit spines work best.</p><label className="primary" htmlFor="book-image">Open camera or gallery</label></>}<input className="file-input" id="book-image" type="file" accept="image/*" capture="environment" onChange={choose}/></div>
    <div className="button-row"><button className="secondary" disabled={loading} onClick={()=>goReview(SAMPLE)}>{loading?"Finding book details…":"Try a sample shelf"}</button></div>{error&&<p role="alert" style={{color:"#a34b43"}}>{error}</p>}<p className="privacy"><span>♢</span> Your photo is used only to identify books and is not stored.</p>
  </section>;
}
