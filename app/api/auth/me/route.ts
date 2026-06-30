import { NextResponse } from "next/server";
import { getAuthenticatedUser, isSupabaseConfigured } from "@/lib/supabase-server";
export const dynamic = "force-dynamic";
export async function GET(){if(!isSupabaseConfigured())return NextResponse.json({configured:false,user:null});const session=await getAuthenticatedUser();return NextResponse.json({configured:true,user:session?{id:session.user.id,email:session.user.email}:null})}
