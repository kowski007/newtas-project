
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { HelpCircle } from "lucide-react";

export default function FAQ() {
  return (
    <div className="container max-w-4xl mx-auto px-4 py-8 space-y-8">
      <div className="flex items-center gap-3">
        <HelpCircle className="h-8 w-8 text-primary" />
        <h1 className="text-2xl items-center font-bold">
          Frequently Asked Questions
        </h1>
      </div>

      <p className="text-lg items-center text-muted-foreground">
        Everything you need to know about Every1.fun
      </p>

      <Card>
        <CardHeader>
          <CardTitle>General Questions</CardTitle>
        </CardHeader>
        <CardContent>
          <Accordion type="single" collapsible className="w-full">
            <AccordionItem value="item-1">
              <AccordionTrigger>What is Every1.fun?</AccordionTrigger>
              <AccordionContent className="text-muted-foreground">
                Every1.fun is a decentralized creator economy platform where you can create and trade creator coins, share content, connect with other creators, and earn E1XP points through engagement. Built on Base blockchain using Zora protocol, we make it easy for anyone to participate in the creator economy.
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-2">
              <AccordionTrigger>
                Do I need cryptocurrency to use this platform?
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground">
                Not necessarily! You can sign up with just an email address and we'll create a smart wallet for you automatically. However, to trade coins, you'll need some ETH on Base network for transaction fees. You can also connect your existing wallet like MetaMask or Coinbase Wallet.
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-3">
              <AccordionTrigger>Is this platform free to use?</AccordionTrigger>
              <AccordionContent className="text-muted-foreground">
                Yes! Creating an account, browsing content, and earning E1XP points is completely free. When you create or trade coins, you'll pay blockchain transaction fees (gas fees) which go to the Base network. We're working on gasless transactions to make it even easier.
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-4">
              <AccordionTrigger>How do I get started?</AccordionTrigger>
              <AccordionContent className="text-muted-foreground">
                Simply click the "Login" button and sign up with your email or connect your crypto wallet. Once logged in, you can explore creators, create your own coin, upload content, and start earning E1XP points. Don't forget to claim your daily login reward!
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-5">
              <AccordionTrigger>What is E1XP?</AccordionTrigger>
              <AccordionContent className="text-muted-foreground">
                E1XP is our platform points system that rewards you for daily engagement. Earn points by logging in daily, maintaining streaks, trading coins, and participating in the community. Build up your streak to multiply your rewards!
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Creator Coins & Trading</CardTitle>
        </CardHeader>
        <CardContent>
          <Accordion type="single" collapsible className="w-full">
            <AccordionItem value="item-6">
              <AccordionTrigger>How do I create my own coin?</AccordionTrigger>
              <AccordionContent className="text-muted-foreground">
                Go to the Create page and upload or link to your content (image, video, URL). Fill in your coin details like name, symbol, and description. Your coin will be deployed on Base blockchain using Zora's creator coin protocol. You can share it with your community immediately!
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-7">
              <AccordionTrigger>How do coin prices work?</AccordionTrigger>
              <AccordionContent className="text-muted-foreground">
                Coin prices follow a bonding curve model - as more people buy a coin, the price increases. When people sell, the price may decrease. This creates fair price discovery based on supply and demand. Early supporters can benefit as coins gain popularity.
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-8">
              <AccordionTrigger>Can I sell my coins anytime?</AccordionTrigger>
              <AccordionContent className="text-muted-foreground">
                Yes! You can buy or sell coins at any time through the trading interface. Simply click on a coin card, select Buy or Sell, enter the amount in ETH, and confirm the transaction. Your balance will update immediately.
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-9">
              <AccordionTrigger>What content can I upload?</AccordionTrigger>
              <AccordionContent className="text-muted-foreground">
                You can upload images, videos, or link to external content. We support various platforms and automatically fetch metadata. Content is stored on IPFS through Pinata for decentralized, permanent storage. Make sure you own the rights to any content you upload.
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-10">
              <AccordionTrigger>
                Do creators earn from their coins?
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground">
                Yes! As the creator, you earn a percentage of trading fees whenever people buy and sell your coins. This creates a sustainable revenue stream that grows with your community's engagement. You can withdraw your earnings anytime from your profile.
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Features & Community</CardTitle>
        </CardHeader>
        <CardContent>
          <Accordion type="single" collapsible className="w-full">
            <AccordionItem value="item-11">
              <AccordionTrigger>Can I message other users?</AccordionTrigger>
              <AccordionContent className="text-muted-foreground">
                Yes! We use the XMTP protocol for decentralized, encrypted messaging. Click the message icon on any user's profile to start a conversation. Your messages are private and stored on the decentralized XMTP network.
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-12">
              <AccordionTrigger>How do daily streaks work?</AccordionTrigger>
              <AccordionContent className="text-muted-foreground">
                Log in daily to build your streak! Each consecutive day increases your E1XP multiplier. The longer your streak, the more points you earn. Miss a day and your streak resets, so stay consistent to maximize rewards.
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-13">
              <AccordionTrigger>What are notifications for?</AccordionTrigger>
              <AccordionContent className="text-muted-foreground">
                Get notified about new coin launches, trending creators, trading activity, messages, and daily reward reminders. Enable push notifications in your browser to stay updated even when you're not on the platform.
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-14">
              <AccordionTrigger>Is there a mobile app?</AccordionTrigger>
              <AccordionContent className="text-muted-foreground">
                Our web app is fully responsive and works great on mobile browsers! We also have Telegram bot integration for notifications and updates. Just use your mobile browser to access the full platform experience.
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Safety & Support</CardTitle>
        </CardHeader>
        <CardContent>
          <Accordion type="single" collapsible className="w-full">
            <AccordionItem value="item-15">
              <AccordionTrigger>Is my wallet safe?</AccordionTrigger>
              <AccordionContent className="text-muted-foreground">
                Absolutely! We use Privy for secure authentication. If you sign up with email, we create a smart wallet that only you control. For external wallets, we never have access to your private keys. All transactions require your explicit approval.
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-16">
              <AccordionTrigger>
                What blockchain is this built on?
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground">
                We're built on Base, an Ethereum Layer 2 network. This means fast, cheap transactions while maintaining the security of Ethereum. All coins are created using Zora's battle-tested creator coin protocol.
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-17">
              <AccordionTrigger>
                What if I have a problem or question?
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground">
                You can reach out through our Telegram community, use the in-app messaging to contact support, or check our comprehensive documentation. We're here to help with any issues or questions you might have!
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-18">
              <AccordionTrigger>
                Are there risks to trading creator coins?
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground">
                Yes, like any investment, trading creator coins carries risk. Coin values can fluctuate significantly. Only invest what you can afford to lose, do your research on creators before buying their coins, and remember that past performance doesn't guarantee future results.
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </CardContent>
      </Card>
    </div>
  );
}
