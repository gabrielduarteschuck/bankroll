"use client";

import { createContext, useContext, useEffect, useRef, useCallback } from "react";
import { usePathname } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

// Gera um ID de sessão único
function generateSessionId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

// Pega ou cria session ID no sessionStorage
function getSessionId(): string {
  if (typeof window === "undefined") return "";

  let sessionId = sessionStorage.getItem("analytics_session_id");
  if (!sessionId) {
    sessionId = generateSessionId();
    sessionStorage.setItem("analytics_session_id", sessionId);
  }
  return sessionId;
}

type EventType =
  | "page_view"
  | "click"
  | "form_submit"
  | "banca_created"
  | "entrada_registered"
  | "suggestion_clicked"
  | "suggestion_voted"
  | "session_start"
  | "session_end";

interface TrackEventParams {
  eventType: EventType;
  pagePath?: string;
  elementId?: string;
  elementText?: string;
  metadata?: Record<string, unknown>;
  timeOnPage?: number;
}

interface AnalyticsContextType {
  trackEvent: (params: TrackEventParams) => void;
  trackClick: (elementId: string, elementText?: string, metadata?: Record<string, unknown>) => void;
  trackBancaCreated: (metadata?: Record<string, unknown>) => void;
  trackEntradaRegistered: (metadata?: Record<string, unknown>) => void;
  trackSuggestionClicked: (suggestionId: string, metadata?: Record<string, unknown>) => void;
  trackSuggestionVoted: (suggestionId: string, voteType: "like" | "dislike") => void;
}

const AnalyticsContext = createContext<AnalyticsContextType | null>(null);

export function AnalyticsProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const lastPathname = useRef<string | null>(null);
  const pageStartTime = useRef<number>(Date.now());
  const sessionId = useRef<string>("");

  // Inicializa session ID no client
  useEffect(() => {
    sessionId.current = getSessionId();

    // Registra início de sessão
    trackEventInternal({
      eventType: "session_start",
      pagePath: pathname,
    });

    // Registra fim de sessão ao fechar
    const handleBeforeUnload = () => {
      const timeOnPage = Math.round((Date.now() - pageStartTime.current) / 1000);

      // Usa sendBeacon para garantir envio
      const payload = JSON.stringify({
        event_type: "session_end",
        page_path: pathname,
        session_id: sessionId.current,
        time_on_page: timeOnPage,
      });

      navigator.sendBeacon?.(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/rpc/track_event`,
        new Blob([payload], { type: "application/json" })
      );
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Track page views automaticamente
  useEffect(() => {
    if (pathname && pathname !== lastPathname.current) {
      // Registra tempo na página anterior
      if (lastPathname.current) {
        const timeOnPage = Math.round((Date.now() - pageStartTime.current) / 1000);

        // Atualiza o último page_view com tempo (se > 1 segundo)
        if (timeOnPage > 1) {
          trackEventInternal({
            eventType: "page_view",
            pagePath: lastPathname.current,
            timeOnPage,
            metadata: { is_exit: true },
          });
        }
      }

      // Registra nova page view
      trackEventInternal({
        eventType: "page_view",
        pagePath: pathname,
      });

      lastPathname.current = pathname;
      pageStartTime.current = Date.now();
    }
  }, [pathname]);

  // Função interna para enviar eventos
  const trackEventInternal = useCallback(async (params: TrackEventParams) => {
    try {
      await supabase.rpc("track_event", {
        p_event_type: params.eventType,
        p_page_path: params.pagePath || pathname,
        p_element_id: params.elementId || null,
        p_element_text: params.elementText || null,
        p_metadata: params.metadata || {},
        p_session_id: sessionId.current,
        p_time_on_page: params.timeOnPage || null,
      });
    } catch (error) {
      // Silently fail - não queremos quebrar a app por causa de analytics
      console.debug("Analytics error:", error);
    }
  }, [pathname]);

  // Funções públicas
  const trackEvent = useCallback((params: TrackEventParams) => {
    trackEventInternal(params);
  }, [trackEventInternal]);

  const trackClick = useCallback((
    elementId: string,
    elementText?: string,
    metadata?: Record<string, unknown>
  ) => {
    trackEventInternal({
      eventType: "click",
      elementId,
      elementText,
      metadata,
    });
  }, [trackEventInternal]);

  const trackBancaCreated = useCallback((metadata?: Record<string, unknown>) => {
    trackEventInternal({
      eventType: "banca_created",
      metadata,
    });
  }, [trackEventInternal]);

  const trackEntradaRegistered = useCallback((metadata?: Record<string, unknown>) => {
    trackEventInternal({
      eventType: "entrada_registered",
      metadata,
    });
  }, [trackEventInternal]);

  const trackSuggestionClicked = useCallback((
    suggestionId: string,
    metadata?: Record<string, unknown>
  ) => {
    trackEventInternal({
      eventType: "suggestion_clicked",
      metadata: { suggestion_id: suggestionId, ...metadata },
    });
  }, [trackEventInternal]);

  const trackSuggestionVoted = useCallback((
    suggestionId: string,
    voteType: "like" | "dislike"
  ) => {
    trackEventInternal({
      eventType: "suggestion_voted",
      metadata: { suggestion_id: suggestionId, vote_type: voteType },
    });
  }, [trackEventInternal]);

  return (
    <AnalyticsContext.Provider
      value={{
        trackEvent,
        trackClick,
        trackBancaCreated,
        trackEntradaRegistered,
        trackSuggestionClicked,
        trackSuggestionVoted,
      }}
    >
      {children}
    </AnalyticsContext.Provider>
  );
}

export function useAnalytics(): AnalyticsContextType {
  const context = useContext(AnalyticsContext);
  if (!context) {
    // Retorna funções vazias se não estiver no provider (evita erros)
    return {
      trackEvent: () => {},
      trackClick: () => {},
      trackBancaCreated: () => {},
      trackEntradaRegistered: () => {},
      trackSuggestionClicked: () => {},
      trackSuggestionVoted: () => {},
    };
  }
  return context;
}
