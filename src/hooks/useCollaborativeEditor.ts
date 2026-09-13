import { useAuth } from "@clerk/nextjs";
import { MonacoBinding } from "y-monaco";
import { useEffect, useRef, useState } from "react";
import { WebsocketProvider } from "y-websocket";
import * as Y from "yjs";
import type { editor } from "monaco-editor";

type Language = "javascript" | "python" | "java";

const META_QUESTION_ID = "questionId";
const META_LANGUAGE = "language";

export function useCollaborativeEditor(
  roomId: string,
  starterCode: string,
  defaultQuestionId: string,
  defaultLanguage: Language
) {
  const { getToken } = useAuth();
  const [isSynced, setIsSynced] = useState(false);
  const [questionId, setQuestionId] = useState(defaultQuestionId);
  const [language, setLanguage] = useState<Language>(defaultLanguage);

  const ydocRef = useRef<Y.Doc | null>(null);
  const providerRef = useRef<WebsocketProvider | null>(null);
  const bindingRef = useRef<MonacoBinding | null>(null);
  const pendingEditorRef = useRef<editor.IStandaloneCodeEditor | null>(null);

  const createBinding = (monacoEditor: editor.IStandaloneCodeEditor) => {
    const ydoc = ydocRef.current;
    if (!ydoc || bindingRef.current) return;

    const ytext = ydoc.getText("monaco");
    const model = monacoEditor.getModel();
    if (!model) return;

    bindingRef.current = new MonacoBinding(
      ytext,
      model,
      new Set([monacoEditor]),
      providerRef.current?.awareness
    );
  };

  useEffect(() => {
    if (!roomId) return;

    const ydoc = new Y.Doc();
    const ytext = ydoc.getText("monaco");
    const meta = ydoc.getMap<string>("meta");

    ydocRef.current = ydoc;

    let provider: WebsocketProvider | null = null;

    const connect = async () => {
      const token = await getToken();
      const wsUrl = process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:1234";

      provider = new WebsocketProvider(wsUrl, roomId, ydoc, {
        connect: true,
        params: { token: token || "" },
      });

      providerRef.current = provider;

      provider.on("sync", (isSynced: boolean) => {
        if (isSynced) {
          if (ytext.length === 0) {
            ytext.insert(0, starterCode);
          }
          if (!meta.get(META_QUESTION_ID)) {
            meta.set(META_QUESTION_ID, defaultQuestionId);
          }
          if (!meta.get(META_LANGUAGE)) {
            meta.set(META_LANGUAGE, defaultLanguage);
          }
          setIsSynced(true);
        }
      });

      meta.observe(() => {
        const qId = meta.get(META_QUESTION_ID);
        const lang = meta.get(META_LANGUAGE) as Language | undefined;
        if (qId) setQuestionId(qId);
        if (lang) setLanguage(lang);
      });
    };

    connect().then(() => {
      if (pendingEditorRef.current) {
        createBinding(pendingEditorRef.current);
      }
    });

    return () => {
      bindingRef.current?.destroy();
      bindingRef.current = null;
      provider?.destroy();
      providerRef.current = null;
      ydoc.destroy();
      ydocRef.current = null;
      setIsSynced(false);
    };
  }, [roomId, getToken, starterCode, defaultQuestionId, defaultLanguage]);

  const bindEditor = (monacoEditor: editor.IStandaloneCodeEditor) => {
    pendingEditorRef.current = monacoEditor;
    createBinding(monacoEditor);
  };

  const updateQuestion = (newQuestionId: string, newStarterCode: string) => {
    const ydoc = ydocRef.current;
    if (!ydoc) return;

    const ytext = ydoc.getText("monaco");
    const meta = ydoc.getMap<string>("meta");

    ydoc.transact(() => {
      ytext.delete(0, ytext.length);
      ytext.insert(0, newStarterCode);
      meta.set(META_QUESTION_ID, newQuestionId);
    });
    setQuestionId(newQuestionId);
  };

  const updateLanguage = (newLanguage: Language, newStarterCode: string) => {
    const ydoc = ydocRef.current;
    if (!ydoc) return;

    const ytext = ydoc.getText("monaco");
    const meta = ydoc.getMap<string>("meta");

    ydoc.transact(() => {
      ytext.delete(0, ytext.length);
      ytext.insert(0, newStarterCode);
      meta.set(META_LANGUAGE, newLanguage);
    });
    setLanguage(newLanguage);
  };

  return {
    isSynced,
    questionId,
    language,
    bindEditor,
    updateQuestion,
    updateLanguage,
  };
}
