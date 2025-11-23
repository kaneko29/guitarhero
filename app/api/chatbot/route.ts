import { NextRequest, NextResponse } from 'next/server'
import { ChatOpenAI } from '@langchain/openai'
import { HumanMessage, AIMessage, SystemMessage } from '@langchain/core/messages'

// Initialize the OpenAI chat model
const model = new ChatOpenAI({
  modelName: 'gpt-4o-mini',
  temperature: 0.7,
  openAIApiKey: process.env.OPENAI_API_KEY,
})

// System prompt for the guitar learning assistant
const getSystemPrompt = (contextString: string) => `You are an expert guitar instructor and music theory teacher helping users learn guitar through GuitarHero, a web app that syncs chords with songs.

Your expertise includes:
- Guitar chord theory, finger positions, and techniques
- Music theory explanations (scales, progressions, keys, etc.)
- Song-specific practice tips and strategies
- Personalized learning guidance based on skill level

When providing guidance:
1. **Chord Guidance**: Explain finger positions, strumming patterns, and transitions between chords
2. **Song-Specific Tips**: Provide practice strategies for specific songs, including difficult sections, chord progressions, and timing
3. **Theory Explanations**: Break down music theory concepts in accessible language with examples

Always be encouraging, clear, and practical. If the user mentions a specific song or chord, provide relevant context. Keep responses concise but informative.${contextString ? `\n\nCurrent Context:\n${contextString}` : ''}`

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { message, chatHistory = [], context } = body

    if (!message) {
      return NextResponse.json(
        { error: 'Message is required' },
        { status: 400 }
      )
    }

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: 'OpenAI API key not configured' },
        { status: 500 }
      )
    }

    // Build context string from provided context
    let contextString = ''
    if (context) {
      if (context.song) {
        contextString += `Current song: ${context.song.title} by ${context.song.artist}\n`
      }
      if (context.chords && context.chords.length > 0) {
        const chordNames = context.chords.map((c: any) => {
          if (typeof c === 'string') return c
          return c.chord || c.chord_name || c
        }).join(', ')
        contextString += `Chords in this song: ${chordNames}\n`
      }
      if (context.currentChord) {
        contextString += `Currently viewing chord: ${context.currentChord}\n`
      }
    }

    // Convert chat history to LangChain messages
    const messages = [
      new SystemMessage(getSystemPrompt(contextString))
    ]

    // Add chat history
    chatHistory.forEach((msg: { role: string; content: string }) => {
      if (msg.role === 'user') {
        messages.push(new HumanMessage(msg.content))
      } else if (msg.role === 'assistant') {
        messages.push(new AIMessage(msg.content))
      }
    })

    // Add the current user message
    messages.push(new HumanMessage(message))

    // Call the model
    const response = await model.invoke(messages)

    return NextResponse.json({
      response: response.content,
    })
  } catch (error: any) {
    console.error('Chatbot API error:', error)
    const errorMessage = error?.message || error?.toString() || 'Unknown error'
    const errorCode = error?.code || ''

    // Provide more helpful error messages
    let userMessage = 'Failed to process chat message'
    if (errorCode === 'invalid_api_key' || errorMessage.includes('Incorrect API key') || errorMessage.includes('401')) {
      userMessage = 'Invalid OpenAI API key. The API key in your .env.local file is incorrect or has been revoked. Please check your API key at https://platform.openai.com/account/api-keys and update it in .env.local'
    } else if (errorMessage.includes('429')) {
      userMessage = 'OpenAI API rate limit exceeded. Please try again later.'
    } else if (errorMessage.includes('insufficient_quota') || errorMessage.includes('billing')) {
      userMessage = 'OpenAI account requires a payment method. Please add a payment method to your OpenAI account at https://platform.openai.com/account/billing'
    } else if (errorMessage.includes('Unauthorized')) {
      userMessage = 'OpenAI API authentication failed. Please check your API key and account status.'
    }

    return NextResponse.json(
      {
        error: userMessage,
        details: errorMessage
      },
      { status: 500 }
    )
  }
}
