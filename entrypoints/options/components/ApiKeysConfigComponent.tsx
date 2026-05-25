import { Button } from '@/components/ui/button';
import { Input } from "@/components/ui/input";
import {
    Select,
    SelectContent,
    SelectGroup,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { cn } from '@/lib/utils';
import { AgentsType, AiAgentApiKeys } from '@/typings/aiModelAdaptor';
import { agentsStorage } from '@/utils/storage';
import { DragDropContext, Draggable, Droppable } from '@hello-pangea/dnd';
import { GripVertical, KeyRound, Plus, X } from 'lucide-react';
import React, { useState } from 'react';
import HeadlingTitle from './common/HeadlingTitle';
import Subtitle from './common/Subtitle';
import OptionSection from './OptionSection';

interface Agent {
    id: number;
    name: AgentsType;
}

function generateOptions(): Agent[] {
    const agents = Object.values(AgentsType);
    return agents.map((agent, index) => ({ name: agent, id: index }));
}

const agents: Agent[] = generateOptions();

const ApiKeysConfigComponent: React.FC = () => {
    const [selectedAgent, setSelectedAgent] = useState<number | null>(null);
    const [apiKey, setApiKey] = useState<string>('');
    const [apiKeys, setApiKeys] = useState<AiAgentApiKeys>([]);

    useEffect(() => {
        agentsStorage.getValue().then((value) => {
            if (value) setApiKeys(value);
        });
    }, []);

    const timer = useRef<any>();
    useEffect(() => {
        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(() => {
            agentsStorage.setValue(apiKeys).then(() => {
                browser.runtime.sendMessage({ from: 'popup', type: "agents-changed" });
            });
        }, 500);
    }, [apiKeys]);

    const handleAddApiKey = () => {
        if (selectedAgent !== null && apiKey.trim() !== '') {
            const agent = agents.find((m) => m.id === selectedAgent);
            if (agent && !apiKeys.some((item) => item.agentName === agent.name)) {
                setApiKeys([...apiKeys, { agentName: agent.name, apiKey }]);
                setSelectedAgent(null);
                setApiKey('');
            }
        }
    };

    const handleInputChange = (index: number, value: string) => {
        const newApiKeys = [...apiKeys];
        newApiKeys[index].apiKey = value;
        setApiKeys(newApiKeys);
    };

    const handleRemoveApiKey = (index: number) => {
        setApiKeys(apiKeys.filter((_, i) => i !== index));
    };

    const handleDragEnd = (result: any) => {
        if (!result.destination) return;
        const reordered = Array.from(apiKeys);
        const [removed] = reordered.splice(result.source.index, 1);
        reordered.splice(result.destination.index, 0, removed);
        setApiKeys(reordered);
    };

    const canAdd = selectedAgent !== null && apiKey.trim() !== '';

    return (
        <OptionSection>
            <HeadlingTitle>
                <KeyRound className="h-5 w-5 text-primary" />
                API Providers
            </HeadlingTitle>
            <Subtitle>
                Select an AI provider and add its API key. Drag to reorder — the provider at the top is used first.
                Higher-tier models give better explanations. The shared XunFeiSpark and ChatAnywhere keys are
                rate-limited demo keys; bring your own key for the best experience.
            </Subtitle>

            {/* Add new */}
            <div className="grid grid-cols-1 md:grid-cols-[minmax(180px,220px)_1fr_auto] items-stretch gap-2">
                {/* @ts-ignore radix select null value */}
                <Select onValueChange={(e) => setSelectedAgent(Number(e))} value={selectedAgent?.toString() || null}>
                    <SelectTrigger className="md:w-[220px]">
                        <SelectValue placeholder="Select AI provider" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectGroup>
                            {agents.map((agent) => (
                                <SelectItem
                                    key={agent.id}
                                    value={agent.id.toString()}
                                    disabled={apiKeys.some((item) => item.agentName === agent.name)}
                                >
                                    {agent.name}
                                </SelectItem>
                            ))}
                        </SelectGroup>
                    </SelectContent>
                </Select>

                <Input
                    type="text"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder="Paste API key"
                    disabled={selectedAgent === null}
                    aria-label="API key"
                />

                <Button onClick={handleAddApiKey} disabled={!canAdd} className="md:w-auto">
                    <Plus className="h-4 w-4" />
                    Add
                </Button>
            </div>

            {/* Provider list */}
            {apiKeys.length === 0 ? (
                <div className="rounded-xl border border-dashed border-border/70 bg-secondary/30 px-4 py-8 text-center text-[13px] text-muted-foreground">
                    No providers configured yet. Add one above to get started.
                </div>
            ) : (
                <DragDropContext onDragEnd={handleDragEnd}>
                    <Droppable droppableId="droppable">
                        {(provided) => (
                            <ul
                                {...provided.droppableProps}
                                ref={provided.innerRef}
                                className="flex flex-col gap-2"
                            >
                                {apiKeys.map((item, index) => (
                                    <Draggable key={item.agentName} draggableId={item.agentName} index={index}>
                                        {(p, snapshot) => (
                                            <li
                                                ref={p.innerRef}
                                                {...p.draggableProps}
                                                className={cn(
                                                    "flex items-center gap-3 rounded-xl border border-border/70 bg-secondary/40 px-3 py-2",
                                                    "transition-shadow duration-150 ease-spring",
                                                    snapshot.isDragging && "shadow-apple-lg bg-card"
                                                )}
                                            >
                                                <span
                                                    {...p.dragHandleProps}
                                                    className="inline-flex h-8 w-8 cursor-grab items-center justify-center rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground active:cursor-grabbing"
                                                    title="Drag to reorder"
                                                    aria-label="Drag to reorder"
                                                >
                                                    <GripVertical className="h-4 w-4" />
                                                </span>

                                                <span className="font-display text-[14px] font-medium min-w-[10ch] truncate">
                                                    {item.agentName}
                                                </span>

                                                <Input
                                                    type="text"
                                                    value={item.apiKey}
                                                    onChange={(e) => handleInputChange(index, e.target.value)}
                                                    placeholder="Enter API key"
                                                    className="flex-1 font-mono text-[13px]"
                                                    aria-label={`${item.agentName} API key`}
                                                />

                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={() => handleRemoveApiKey(index)}
                                                    aria-label={`Remove ${item.agentName}`}
                                                    title="Remove"
                                                    className="text-muted-foreground hover:text-destructive"
                                                >
                                                    <X className="h-4 w-4" />
                                                </Button>
                                            </li>
                                        )}
                                    </Draggable>
                                ))}
                                {provided.placeholder}
                            </ul>
                        )}
                    </Droppable>
                </DragDropContext>
            )}
        </OptionSection>
    );
};

export default ApiKeysConfigComponent;
