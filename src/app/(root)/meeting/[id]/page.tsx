"use client";

import LoaderUI from "@/components/LoaderUI";
import MeetingRoom from "@/components/MeetingRoom";
import MeetingSetup from "@/components/MeetingSetup";
import useGetCallById from "@/hooks/useGetCallById";
import { useUser } from "@clerk/nextjs";
import { useQuery } from "convex/react";
import { api } from "../../../../../convex/_generated/api";
import { StreamCall, StreamTheme } from "@stream-io/video-react-sdk";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

function MeetingPage() {
  const { id } = useParams();
  const router = useRouter();
  const { isLoaded } = useUser();
  const { call, isCallLoading } = useGetCallById(id);

  const [isSetupComplete, setIsSetupComplete] = useState(false);

  const streamCallId = typeof id === "string" ? id : id?.[0] || "";

  const joinAccess = useQuery(
    api.interviews.canJoinMeeting,
    streamCallId ? { streamCallId } : "skip"
  );

  useEffect(() => {
    if (joinAccess && !joinAccess.allowed) {
      router.push("/");
    }
  }, [joinAccess, router]);

  if (!isLoaded || isCallLoading || joinAccess === undefined) return <LoaderUI />;

  if (!call) {
    return (
      <div className="h-screen flex items-center justify-center">
        <p className="text-2xl font-semibold">Meeting not found</p>
      </div>
    );
  }

  if (!joinAccess.allowed) {
    return (
      <div className="h-screen flex items-center justify-center">
        <p className="text-2xl font-semibold">You are not authorized to join this meeting</p>
      </div>
    );
  }

  return (
    <StreamCall call={call}>
      <StreamTheme>
        {!isSetupComplete ? (
          <MeetingSetup onSetupComplete={() => setIsSetupComplete(true)} />
        ) : (
          <MeetingRoom />
        )}
      </StreamTheme>
    </StreamCall>
  );
}
export default MeetingPage;
