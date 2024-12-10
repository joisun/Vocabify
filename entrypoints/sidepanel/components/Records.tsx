import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { ChevronsDown, ChevronsUp, Edit } from "lucide-react";

export default function Records() {
  const records = [
    {
      wordOrPrase: "Render",
      meaning: ` | React renders a component | 🔄💻🎨
React is a JavaScript library used for building user interfaces. It helps developers create reusable UI components that can be easily rendered on the web or mobile devices. When you use React, you write code that tells the library how to display your data and user interactions. One of the most common ways to display this data is by rendering a component. A component is a self-contained piece of UI that can be reused in different parts of an application. For example, you might have a button component that can be used in multiple places throughout your app. React renders these components into the DOM, which is the structure that makes up a web page.

Example sentences:

1. I used React to build a new component for my app.
2. The React library allows me to render complex components with ease.
3. When a user interacts with my app, React automatically updates the component that was affected. `,
    },
    {
      wordOrPrase: "Commit",
      meaning: ` **Commit**  |  /kəˈmɪt/ noun |

A promise or decision to do something, often with strong feelings of loyalty or dedication. 🤝💪

Example sentences:
1. She made a commitment to finish her project by the end of the week. 📅⏰
2. He's committed to his job and always arrives on time. 🕒💼
3. The couple committed to each other in marriage. 💍💑`,
    },
  ];
  return (
    <div>
      {records.map(({ wordOrPrase, meaning }) => {
        return <Record wordOrPrase={wordOrPrase} meaning={meaning} />;
      })}
    </div>
  );
}

function Record({
  wordOrPrase,
  meaning,
}: {
  wordOrPrase: string;
  meaning: string;
}) {
  const [expand, setExpand] = useState(false);
  const toggleExpand = () => {
    setExpand(!expand);
  };
  return (
    <div className="mt-2 rounded-xl border bg-card text-card-foreground shadow px-4 pt-6 relative">
      <div className="absolute right-1 top-1">
        <Button variant={"ghost"} size="icon">
          <Edit />
        </Button>
      </div>

      <Label>
        <span className="text-lg bg-gradient-to-b  from-transparent from-70% via-[percentage:70%_70%] via-indigo-600/80  to-indigo-600/80">
          {wordOrPrase}
        </span>
      </Label>

      <div
        className={cn(
          "grid my-1 transition-all duration-700 ease-in-out grid-rows-[0fr]",
          expand ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
        )}
      >
        <div className="overflow-hidden">
          <div>{meaning}</div>
        </div>
      </div>

      {!expand && (
        <p className="animate-fadeIn">{meaning.substring(0, 150)}...</p>
      )}

      <Button variant="ghost" className="w-full my-2" onClick={toggleExpand}>
        {expand ? (
          <ChevronsUp className="animate-pulse" size="20" />
        ) : (
          <ChevronsDown className="animate-pulse" size="20" />
        )}
      </Button>
    </div>
  );
}
