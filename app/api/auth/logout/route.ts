import { NextResponse } from "next/server";
import { clearSessionCookies, getAuthenticatedUser, getSupabaseConfig } from "@/lib/supabase-server";
export async function POST(){const session=await getAuthenticatedUser();const {url,key}=getSupabaseConfig();if(session&&url&&key)await fetch(`${url}/auth/v1/logout`,{method:"POST",headers:{apikey:key,Authorization:`Bearer ${session.accessToken}`}}).catch(()=>null);clearSessionCookies();return NextResponse.json({ok:true})}
