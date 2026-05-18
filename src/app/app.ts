import {
  Component,
  signal,
  computed,
  ElementRef,
  ViewChild,
  AfterViewChecked,
  ChangeDetectionStrategy,
  NgZone,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import {
  LucideAngularModule,
  BotMessageSquare,
  Sparkles,
  type LucideIconData,
} from 'lucide-angular';

export interface ThinkingBlock {
  content: string;
  durationMs: number;
  isExpanded: boolean;
}

export interface ToolCall {
  id: string;
  name: string;
  label: string;
  inputSummary: string;
  output?: string;
  status: 'running' | 'done' | 'error';
  durationMs?: number;
  isOutputExpanded: boolean;
}

export interface AIMessage {
  id: number;
  role: 'user' | 'assistant';
  text: string;
  displayedText: string;
  time: string;
  isNew?: boolean;
  thinking?: ThinkingBlock;
  toolCalls?: ToolCall[];
  isStreaming?: boolean;
}

export interface ConversationThread {
  id: number;
  title: string;
  group: 'Today' | 'Yesterday' | 'Earlier';
  active: boolean;
}

const TOOL_TEMPLATES = [
  {
    name: 'web_search',
    label: 'Web Search',
    makeInput: (q: string) => `{ "query": "${q.slice(0, 40)}" }`,
    output: '{"results": [{"title": "Relevant result 1", "snippet": "Found relevant information about the topic..."}, {"title": "Relevant result 2", "snippet": "Additional context and details..."}]}',
  },
  {
    name: 'read_file',
    label: 'Read File',
    makeInput: () => '{ "path": "context/knowledge_base.md" }',
    output: '# Knowledge Base\n\nRetrieved 2.4 KB of relevant context from the knowledge base.',
  },
  {
    name: 'run_code',
    label: 'Run Code',
    makeInput: () => '{ "language": "python", "code": "import json\\nresult = process_query(input_data)\\nprint(json.dumps(result))" }',
    output: '{"status": "success", "output": "Processing complete. 142 records analyzed."}',
  },
];

const THINKING_TEXTS = [
  `The user is asking about this topic. Let me consider the key aspects carefully.\n\nFirst, I should think about the context and what's most relevant here. There are a few angles to consider:\n\n1. The immediate question being asked\n2. What background knowledge applies\n3. The most useful framing for the response\n\nI think the best approach is to be direct and comprehensive while keeping the response focused.`,
  `Let me reason through this step by step.\n\nThe question touches on several interconnected concepts. I need to be careful not to oversimplify, but also not to overwhelm with unnecessary detail.\n\nKey considerations:\n- Accuracy of the core claim\n- Practical implications\n- What the user likely wants to know vs. what they asked\n\nI'll structure my response to address the direct question first, then provide supporting context.`,
  `Thinking about this carefully...\n\nThere's an interesting tension here between different valid approaches. Let me work through them:\n\nApproach A would be straightforward but might miss nuance.\nApproach B is more thorough but could be verbose.\n\nI'll aim for a balanced response that captures the essential insight without unnecessary elaboration. The user seems to want a practical answer.`,
];

const AI_RESPONSES = [
  `That's a great question. Based on my analysis, here's what I found:\n\nThe core insight is that modern systems work best when they balance simplicity with expressiveness. Rather than forcing a rigid structure, allowing flexibility at the right abstraction layer leads to better outcomes.\n\nIn practice, this means starting with clear primitives and composing them thoughtfully. The patterns that emerge naturally tend to be more maintainable than those imposed from the start.`,
  `After searching and reviewing the relevant context, here's a concise answer:\n\nThe key factor is understanding the tradeoffs involved. There's no universal best approach — the right choice depends on your specific constraints, the scale you're operating at, and the team's existing expertise.\n\nMy recommendation would be to start with the simplest solution that could work, measure its behavior under real conditions, and iterate from there.`,
  `Here's what I found after running the analysis:\n\nThe results are interesting — there's a clear pattern in the data that suggests the initial hypothesis was on the right track, but with an important caveat.\n\nThe variance increases significantly at the edge cases, which means your solution needs to handle those explicitly. I'd suggest adding validation at the input boundary and a fallback for the outlier scenarios.`,
];

@Component({
  selector: 'app-root',
  imports: [FormsModule, CommonModule, LucideAngularModule],
  templateUrl: './app.html',
  styleUrl: './app.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class App implements AfterViewChecked {
  @ViewChild('messageList') messageListRef!: ElementRef<HTMLElement>;
  @ViewChild('inputEl') inputElRef!: ElementRef<HTMLTextAreaElement>;

  private msgIdCounter = 1;
  private shouldScrollToBottom = false;

  readonly BotMessageSquare: LucideIconData = BotMessageSquare;
  readonly Sparkles: LucideIconData = Sparkles;

  readonly isDark = signal(false);
  readonly isGenerating = signal(false);
  readonly selectedModel = signal('claude-sonnet-4-6');
  readonly inputText = signal('');

  readonly threads = signal<ConversationThread[]>([
    { id: 1, title: 'Angular Tailwind UI setup', group: 'Today', active: true },
    { id: 2, title: 'Reasoning UI design patterns', group: 'Today', active: false },
    { id: 3, title: 'TypeScript signal architecture', group: 'Yesterday', active: false },
    { id: 4, title: 'CSS animation techniques', group: 'Yesterday', active: false },
    { id: 5, title: 'esbuild PostCSS integration', group: 'Earlier', active: false },
    { id: 6, title: 'Component library review', group: 'Earlier', active: false },
  ]);

  readonly messages = signal<AIMessage[]>([
    {
      id: this.msgIdCounter++,
      role: 'user',
      text: 'Can you help me design an AI assistant UI that shows reasoning and tool use?',
      displayedText: 'Can you help me design an AI assistant UI that shows reasoning and tool use?',
      time: '9:41 AM',
    },
    {
      id: this.msgIdCounter++,
      role: 'assistant',
      text: `Great question! Here's how I'd approach designing an AI assistant UI that makes reasoning and tool use visible:\n\nThe key is transparency without clutter. Users should be able to see *what* the AI is doing and *why*, but not be overwhelmed by it.\n\n**Reasoning blocks** should be collapsible — show a summary by default, full trace on demand. Use a distinct visual treatment (subtle left border, muted text) to signal "this is the AI thinking, not the response."\n\n**Tool calls** deserve their own card component with status indicators. Running → done transitions with smooth animations make the process feel alive rather than jarring.`,
      displayedText: `Great question! Here's how I'd approach designing an AI assistant UI that makes reasoning and tool use visible:\n\nThe key is transparency without clutter. Users should be able to see *what* the AI is doing and *why*, but not be overwhelmed by it.\n\n**Reasoning blocks** should be collapsible — show a summary by default, full trace on demand. Use a distinct visual treatment (subtle left border, muted text) to signal "this is the AI thinking, not the response."\n\n**Tool calls** deserve their own card component with status indicators. Running → done transitions with smooth animations make the process feel alive rather than jarring.`,
      time: '9:41 AM',
      thinking: {
        content: `The user wants an AI assistant UI. Let me think about what makes these interfaces distinctive.\n\nKey elements to consider:\n1. Showing reasoning/thinking without overwhelming the user\n2. Tool call visualization that feels polished\n3. Differentiating "thinking" from "response" visually\n\nI should give concrete, actionable advice on the visual design approach.`,
        durationMs: 1840,
        isExpanded: false,
      },
      toolCalls: [
        {
          id: 'tc-0',
          name: 'web_search',
          label: 'Web Search',
          inputSummary: '{ "query": "AI chat UI reasoning visualization patterns" }',
          output: '{"results": [{"title": "AI UI Design Patterns 2024"}, {"title": "Making LLM reasoning visible"}]}',
          status: 'done',
          durationMs: 312,
          isOutputExpanded: false,
        },
      ],
    },
  ]);

  readonly threadGroups = computed(() => {
    const groups: Record<string, ConversationThread[]> = {};
    for (const t of this.threads()) {
      if (!groups[t.group]) groups[t.group] = [];
      groups[t.group].push(t);
    }
    return ['Today', 'Yesterday', 'Earlier']
      .filter(g => groups[g])
      .map(g => ({ label: g, items: groups[g] }));
  });

  readonly approxTokens = computed(() => {
    const chars = this.inputText().length;
    return Math.max(0, Math.round(chars / 4));
  });

  constructor(private zone: NgZone) {}

  toggleTheme(): void { this.isDark.update(v => !v); }

  selectThread(id: number): void {
    this.threads.update(list => list.map(t => ({ ...t, active: t.id === id })));
  }

  newChat(): void {
    const newId = Math.max(...this.threads().map(t => t.id)) + 1;
    this.threads.update(list => [
      { id: newId, title: 'New conversation', group: 'Today', active: true },
      ...list.map(t => ({ ...t, active: false })),
    ]);
    this.messages.set([]);
  }

  sendMessage(): void {
    const text = this.inputText().trim();
    if (!text || this.isGenerating()) return;

    const userMsg: AIMessage = {
      id: this.msgIdCounter++,
      role: 'user',
      text,
      displayedText: text,
      time: this.getNow(),
      isNew: true,
    };

    this.messages.update(msgs => [...msgs, userMsg]);
    this.inputText.set('');
    this.shouldScrollToBottom = true;
    this.simulateAIResponse(text);
  }

  private simulateAIResponse(userInput: string): void {
    this.isGenerating.set(true);

    const thinkingText = THINKING_TEXTS[Math.floor(Math.random() * THINKING_TEXTS.length)];
    const responseText = AI_RESPONSES[Math.floor(Math.random() * AI_RESPONSES.length)];
    const toolTemplate = TOOL_TEMPLATES[Math.floor(Math.random() * TOOL_TEMPLATES.length)];
    const useTools = Math.random() > 0.3;

    const assistantId = this.msgIdCounter++;

    // Step 1: Add assistant message with thinking (streaming)
    setTimeout(() => {
      const assistantMsg: AIMessage = {
        id: assistantId,
        role: 'assistant',
        text: responseText,
        displayedText: '',
        time: this.getNow(),
        isNew: true,
        isStreaming: true,
        thinking: {
          content: thinkingText,
          durationMs: 0,
          isExpanded: true,
        },
        toolCalls: [],
      };
      this.messages.update(msgs => [...msgs, assistantMsg]);
      this.shouldScrollToBottom = true;

      // Step 2: Finish thinking after 1.6s
      setTimeout(() => {
        this.messages.update(msgs => msgs.map(m =>
          m.id === assistantId && m.thinking
            ? { ...m, thinking: { ...m.thinking, durationMs: 1640, isExpanded: false } }
            : m
        ));

        if (useTools) {
          // Step 3: Add tool call (running)
          setTimeout(() => {
            const toolCall: ToolCall = {
              id: `tc-${assistantId}`,
              name: toolTemplate.name,
              label: toolTemplate.label,
              inputSummary: toolTemplate.makeInput(userInput),
              status: 'running',
              isOutputExpanded: false,
            };
            this.messages.update(msgs => msgs.map(m =>
              m.id === assistantId ? { ...m, toolCalls: [toolCall] } : m
            ));
            this.shouldScrollToBottom = true;

            // Step 4: Tool call done
            setTimeout(() => {
              this.messages.update(msgs => msgs.map(m =>
                m.id === assistantId
                  ? {
                      ...m,
                      toolCalls: m.toolCalls!.map(tc =>
                        tc.id === toolCall.id
                          ? { ...tc, status: 'done', durationMs: 480, output: toolTemplate.output }
                          : tc
                      ),
                    }
                  : m
              ));

              // Step 5: Stream response
              setTimeout(() => this.streamResponse(assistantId, responseText), 300);
            }, 900);
          }, 400);
        } else {
          setTimeout(() => this.streamResponse(assistantId, responseText), 400);
        }
      }, 1600);
    }, 400);
  }

  private streamResponse(msgId: number, fullText: string): void {
    let i = 0;
    const chunkSize = 3;

    const tick = () => {
      if (i >= fullText.length) {
        this.messages.update(msgs => msgs.map(m =>
          m.id === msgId ? { ...m, displayedText: fullText, isStreaming: false } : m
        ));
        this.isGenerating.set(false);
        return;
      }
      i = Math.min(i + chunkSize, fullText.length);
      this.messages.update(msgs => msgs.map(m =>
        m.id === msgId ? { ...m, displayedText: fullText.slice(0, i) } : m
      ));
      this.shouldScrollToBottom = true;
      this.zone.runOutsideAngular(() => {
        setTimeout(() => this.zone.run(() => tick()), 18);
      });
    };
    tick();
  }

  toggleThinking(msgId: number): void {
    this.messages.update(msgs => msgs.map(m =>
      m.id === msgId && m.thinking
        ? { ...m, thinking: { ...m.thinking, isExpanded: !m.thinking.isExpanded } }
        : m
    ));
  }

  toggleToolOutput(msgId: number, toolId: string): void {
    this.messages.update(msgs => msgs.map(m =>
      m.id === msgId
        ? {
            ...m,
            toolCalls: m.toolCalls?.map(tc =>
              tc.id === toolId ? { ...tc, isOutputExpanded: !tc.isOutputExpanded } : tc
            ),
          }
        : m
    ));
  }

  stopGenerating(): void {
    this.isGenerating.set(false);
    this.messages.update(msgs => msgs.map(m =>
      m.isStreaming ? { ...m, isStreaming: false } : m
    ));
  }

  onKeydown(event: KeyboardEvent): void {
    if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
      event.preventDefault();
      this.sendMessage();
    }
  }

  ngAfterViewChecked(): void {
    if (this.shouldScrollToBottom && this.messageListRef) {
      const el = this.messageListRef.nativeElement;
      el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
      this.shouldScrollToBottom = false;
    }
  }

  private getNow(): string {
    return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  trackByMsg(_: number, m: AIMessage): number { return m.id; }
  trackByThread(_: number, t: ConversationThread): number { return t.id; }
}
