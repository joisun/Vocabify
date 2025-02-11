import { AgentsType, AiAgentApiKeys } from '@/typings/aiModelAdaptor';
import { agentsStorage } from '@/utils/storage';
import { DragDropContext, Draggable, Droppable } from '@hello-pangea/dnd';
import React, { useState } from 'react';
import styles from './ApiKeysConfigComponent.module.css';
import HeadlingTitle from './common/HeadlingTitle';
import Subtitle from './common/Subtitle';
import { DragSvgIcon } from './icons/dragSvgIcon';
import { RemoveSvgIcon } from './icons/RemoveSvgIcon';
import {
    Select,
    SelectContent,
    SelectGroup,
    SelectItem,
    SelectLabel,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Button } from '@/components/ui/button';
import OptionSection from './OptionSection';
interface Agent {
    id: number;
    name: AgentsType;
}


function generateOptions() {
    const agents = Object.values(AgentsType);
    console.log('agents', agents);
    return agents.map((agent, index) => {
        return {
            name: agent,
            id: index
        }
    })

}
const agents: Agent[] = generateOptions()

const ApiKeysConfigComponent: React.FC = () => {
    const [selectedAgent, setSelectedAgent] = useState<number | null>(null);
    const [apiKey, setApiKey] = useState<string>('');
    const [apiKeys, setApiKeys] = useState<AiAgentApiKeys>([]);

    // 还原设定值
    useEffect(() => {
        agentsStorage.getValue().then((value) => {
            if (value) {
                console.log('value', value);
                setApiKeys(value);
            }

        });
    }, []);

    // 防抖
    const timer = useRef<any>();
    useEffect(() => {
        if (timer.current) {
            clearTimeout(timer.current)
        }
        timer.current = setTimeout(() => {
            agentsStorage.setValue(apiKeys).then(() => {
                console.log('apiKeys', apiKeys);
                browser.runtime.sendMessage({ from: 'popup', type: "agents-changed" });
            });
        }, 500)

    }, [apiKeys]);






    const handleAddApiKey = () => {
        if (selectedAgent !== null && apiKey.trim() !== '') {
            const agent = agents.find(m => m.id === selectedAgent);
            if (agent && !apiKeys.some(item => item.agentName === agent.name)) {
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
        const newApiKeys = apiKeys.filter((_, i) => i !== index);
        setApiKeys(newApiKeys);
    };

    const handleDragEnd = (result: any) => {
        if (!result.destination) return;
        const reorderedApiKeys = Array.from(apiKeys);
        const [removed] = reorderedApiKeys.splice(result.source.index, 1);
        reorderedApiKeys.splice(result.destination.index, 0, removed);
        setApiKeys(reorderedApiKeys);
    };


    return (
        <OptionSection>
            <div className={styles.container}>
                <HeadlingTitle >API Providers Management</HeadlingTitle>
                <Subtitle>Select the API provider, and drag to reorder. The provider at the front will be prioritized.

                The more advanced the AI provider you configure, the more accurate the language parsing and the higher the quality. The XunFeiSpark and ChatAnywhere GPT-3.5 Turbo API keys provided are trial keys, shared by all users. They have daily limitations and may become invalid at any time. We recommend using your own API key.
                </Subtitle>
                <p className={styles.operation}>
                    {/* <select onChange={e => setSelectedAgent(Number(e.target.value))} value={selectedAgent || ''} className='flex h-9 items-center justify-between whitespace-nowrap rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50 [&>span]:line-clamp-1 w-[180px]' >
                    <option className='bg-background ' value="" disabled>选择API提供方</option>
                    {agents.map(agent => (
                        <option className='bg-background ' key={agent.id} value={agent.id} disabled={apiKeys.some(item => item.agentName === agent.name)}>
                            {agent.name}
                        </option>
                    ))}
                </select> */}

                    {/* shadcn bug not fixed: https://github.com/shadcn-ui/ui/issues/2054 */}
                    {/* @ts-ignore */}
                    <Select onValueChange={e => setSelectedAgent(Number(e))} value={selectedAgent?.toString() || null}>
                        <SelectTrigger className="w-100">
                            <SelectValue placeholder="Select the AI provider" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectGroup>
                                {/* <SelectLabel>Fruits</SelectLabel> */}
                                {/* @ts-ignore */}
                                <SelectItem value={null} disabled>Select the AI provider</SelectItem>
                                {agents.map(agent => (
                                    <SelectItem key={agent.id} value={agent.id.toString()} disabled={apiKeys.some(item => item.agentName === agent.name)}>
                                        {agent.name}
                                    </SelectItem>
                                ))}
                            </SelectGroup>
                        </SelectContent>
                    </Select>

                    <Input
                        type="text"
                        value={apiKey}
                        onChange={e => setApiKey(e.target.value)}
                        placeholder="Input API key here"
                        disabled={selectedAgent === null}
                    />
                    <Button onClick={handleAddApiKey} disabled={selectedAgent === null || apiKey.trim() === ''}>
                        Add
                    </Button>
                </p>

                <DragDropContext onDragEnd={handleDragEnd}>
                    <Droppable droppableId="droppable">
                        {(provided) => (
                            <ul {...provided.droppableProps} ref={provided.innerRef} className={styles.list}>
                                {apiKeys.map((item, index) => (
                                    <Draggable key={item.agentName} draggableId={item.agentName} index={index}>
                                        {(provided) => (
                                            <li
                                                ref={provided.innerRef}
                                                {...provided.draggableProps}
                                                className="bg-background flex justify-start items-center px-2 py-1 border mb-2 gap-4"
                                            >
                                                <span
                                                    {...provided.dragHandleProps}
                                                    className={styles.dragHandle}
                                                    title="drag sort"
                                                >
                                                    <DragSvgIcon className={styles.dragBtn} style={{ fontSize: '24px' }} /> {/* 拖拽图标 */}
                                                </span>
                                                <label className='w-[40ch] overflow-ellipsis overflow-hidden'>{item.agentName}</label>
                                                <Input
                                                    className=""
                                                    type="text"
                                                    value={item.apiKey}
                                                    onChange={e => handleInputChange(index, e.target.value)}
                                                    placeholder="Enter API key"
                                                />
                                                <Button variant='destructive' onClick={() => handleRemoveApiKey(index)}>
                                                    <RemoveSvgIcon style={{ fontSize: '16px' }} />
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
            </div>
        </OptionSection>
    );
};

export default ApiKeysConfigComponent;
