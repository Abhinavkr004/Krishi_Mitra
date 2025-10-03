// src/app/test/page.tsx

"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Leaf, Droplet, Sun, Wind } from "lucide-react";

export default function TestPage() {
  return (
    <div className="p-10 bg-gray-900 min-h-screen">
      <h1 className="text-white text-3xl text-center mb-8">Tabs Test Page</h1>
      <Tabs defaultValue="soil" className="w-full max-w-4xl mx-auto">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="soil">Soil Health</TabsTrigger>
          <TabsTrigger value="water">Water Management</TabsTrigger>
          <TabsTrigger value="pests">Pest Control</TabsTrigger>
          <TabsTrigger value="nutrients">Nutrient Optimization</TabsTrigger>
        </TabsList>
        <TabsContent value="soil">
          <Card>
            <CardContent className="flex items-center p-6">
              <Leaf className="h-10 w-10 text-green-500 mr-4" />
              <div>
                <h3 className="text-lg font-semibold mb-2">Soil Health Score</h3>
                <Progress value={66} className="w-[60%]" />
                <p className="mt-2">Your soil health is improving.</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="water">
          <Card>
            <CardContent className="flex items-center p-6">
              <Droplet className="h-10 w-10 text-blue-500 mr-4" />
              <div>
                <h3 className="text-lg font-semibold mb-2">Water Efficiency</h3>
                <Progress value={78} className="w-[60%]" />
                <p className="mt-2">Your water usage is efficient.</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        {/* Add other TabsContent sections if you wish */}
      </Tabs>
    </div>
  );
}