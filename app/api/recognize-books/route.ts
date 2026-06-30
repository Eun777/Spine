import { NextResponse } from "next/server";
import { hasAiAccess } from "@/lib/ai-access";
import { getAuthenticatedUser } from "@/lib/supabase-server";

const schema={name:"detected_books",strict:true,schema:{type:"object",properties:{books:{type:"array",items:{type:"object",properties:{title:{type:"string"},author:{type:"string"},isbn:{type:["string","null"]},genre:{type:["string","null"]},confidence_score:{type:"number"}},required:["title","author","isbn","genre","confidence_score"],additionalProperties:false}}},required:["books"],additionalProperties:false}};

export async function POST(request:Request){
  try{if(!await getAuthenticatedUser())return NextResponse.json({error:"Please sign in first."},{status:401});if(!hasAiAccess())return NextResponse.json({error:"A valid scan access code is required."},{status:403});const {image}=await request.json();if(!image||typeof image!=="string")return NextResponse.json({error:"An image is required."},{status:400});
    if(!process.env.OPENAI_API_KEY)return NextResponse.json({error:"AI recognition is not configured yet. Use “Try a sample shelf” to explore the complete flow."},{status:503});
    const response=await fetch("https://api.openai.com/v1/chat/completions",{method:"POST",headers:{Authorization:`Bearer ${process.env.OPENAI_API_KEY}`,"Content-Type":"application/json"},body:JSON.stringify({model:"gpt-4o-mini",messages:[{role:"system",content:"Identify every visible book. Read covers and spines carefully. Infer genre when needed. Use lower confidence for uncertain fields. Return an empty array if no book is visible."},{role:"user",content:[{type:"text",text:"Extract all books in this image."},{type:"image_url",image_url:{url:image,detail:"high"}}]}],response_format:{type:"json_schema",json_schema:schema},max_tokens:1800})});
    if(!response.ok){const detail=await response.text();console.error("OpenAI error",detail);return NextResponse.json({error:"Recognition is temporarily unavailable. Please try again."},{status:502})}
    const result=await response.json();const content=result.choices?.[0]?.message?.content;return NextResponse.json(JSON.parse(content||'{"books":[]}'));
  }catch(error){console.error(error);return NextResponse.json({error:"We couldn’t read that image. Please try another."},{status:500})}
}
