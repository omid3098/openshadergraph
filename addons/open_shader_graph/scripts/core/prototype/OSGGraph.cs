using System;
using System.Collections.Generic;
using Godot;

/*
    this is a prototype page has no use in the actual code,
    I am just pouring my mind into this page for now
*/

class OSGPin
{
    public string name;
    public string dataType; // float|int|etc
    public string pinType; // in|out
    public string value;

    /*
        - defaultValue is redandant, it can be exist in the template, 
        and value will be set from the template's defaultValue on creating
        - input don't need to know if it is connected to anything, or what is it connected to.
        the code/shader generator will check all these
    */
}

class OSGNodeTemplate
{
    public string name;
    public string category;
    public string defaultValue;
    public List<OSGPin> inputs;
    public List<OSGPin> outputs;
    public string code;
}

class OSGNode
{
    public string name;
    public string template;
    public Vector2 position;

    /*
        - not sure if we need these here, or we gonna have an explicit OSGGroupNode that has this.
        public string parent;
        public List<OSGNode> children;

        - template is string to load from the registered templates.
        also can be an OSGNodeTemplate reference
    */
}

class OSGEdge
{
    public string input;
    public string output;
    /*
      we can use address as the connection values
      e.g, graph1/node2/pin1
      otherwise it needs to have a node field, and a pin name from the node.
    */
}
class OSGGraph
{
    public string type;
    public Dictionary<string, object> meta;
    public List<OSGPin> inputs;
    public List<OSGPin> outputs;
    public List<OSGNode> nodes;
    public List<OSGEdge> edges;

    /*
        input can be none, but it needs to at least have one output
        unless we want to do referencing and change the value inside the graph/function.
        e.g,
        void do_somthing(int& a)
        {
            a = a*2;
        }
    */
}

class Test
{
    void test()
    {
        OSGNodeTemplate floatTemplate = new()
        {
            name = "float",
            category = "constant",
            defaultValue = "1",
            // not sure if float constant need input
            inputs = [
                new OSGPin()
                {
                    name = "pin1",
                    dataType = "float",
                    pinType = "in",
                    value = "0"
                }
            ],
            outputs = [
                new OSGPin()
                {
                    name = "pin1",
                    dataType = "float",
                    pinType = "out",
                    value = "0"
                }
            ]
        };


    }
}