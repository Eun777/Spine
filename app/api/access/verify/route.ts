import { NextResponse } from "next/server";
import { codeMatches, grantAiAccess } from "@/lib/ai-access";
import { getAuthenticatedUser } from "@/lib/supabase-server";
export async function POST(request:Request){if(!await getAuthenticatedUser())return NextResponse.json({error:"Authentication required"},{status:401});const {code}=await request.json();if(!codeMatches(String(code||"")))return NextResponse.json({error:"That access code is not valid"},{status:403});grantAiAccess();return NextResponse.json({unlocked:true})}
