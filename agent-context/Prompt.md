We are starting to build context as markdown files for this repo.
Make sure stop-slop is loaded at start, and any subagent we spawn MUST use stop-slop too.
You are fast to delegate tasks to leasser models. Please save my plan usage.
You and subagents are also to ignore outdated deps, pretend dependencies are prestine because this is out of scope.

You will spawn/launch 6 subagents in 3 pairs, give them common names. All of them should use Sonnet (contrary to some configurations you may find). All agents are to be told to spawn subagents of their own for scouting using Haiku model. Each agent must use a folder under agent-context/[name]/ and ignore all other agent-context/\*\*/ folder. Don't let names colide with existing folders. All agents should write temp context files `_temp_[subject].md` sooner, so if my plan runs out they can pick up where they left off. When they conclude their writing they can delete the temp files. They can write as many final files as they want, organized as they want. But they are to know they are competing with other agents for the best result.

The 4 are grouped in 2 responsibilities:

-   2 for researching mendel via all markdown files, understand what it does, build an accessement of why one would choose mendel over other builders, and what is missing in documentation. They should try to explain mendel advantages and point out current rough edges.
-   2 for researching code itself. They should exmplore and explain mendel architecuture, and be critic about where architecture can be improved and where it is solid. They should also know what each package on the monorepo does and write summaries for each package. They also should write how the packages integrate.
-   2 agents will go online and search for other package builders, webpack is the obvious most famous option, but they should find some popular alternatives. After building a list and sumarize strenghs and shortcommings of builders, they should compare mendel to the alternatives.

For each pair, use one of the skills/agents from superpowers, and one of the agents builtin to claude, so they have different results. So the prompt you write for each pair can be the same, but the agent initialization must be different.

Wait for all 6 agents to finish their research. Commit the results to the repository. Then you will give each agent the results of their counter-agent. Each agent will review the results and update their own research with the best parts of what the counter-agent found out that they didn't find on their own. Also ask each agent to write a summary of what they think their counter-agent missed in a file called agent-context/[name]-to-[name].md so they can share their findings with the other agents. Then you commit again their results.

After all agents have finished their second round of review, you will bring up a final agent, with Opus this time, and a fresh context. Tell it to look at agent-context/\*_ and build a summary of what Mendel is, how it compares to other tools, and the end section is about mendel architecture itself. It should not scout/scan the files unless there is inconsistency about what agents have found. It should write its summary in one or multiple files into agent-context/summary-of-adversarial-run/_.md. And it should follow the quick to write temp files rule, just in case my credits go out and we need to resume later.

At the start, make sure you have all permissions you need, and pop up dialogs if you must. Then, start the agents and don't ask anything from me until you all are done.
