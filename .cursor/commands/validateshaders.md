run `bun run validate:shaders` and make sure all the shaders compile.
if it fails, it means we either have a bug in the compiler or the template in the shader language pack is incorrect.
We should be careful to generate shaders that are reasonably correct. if they compile, it doesn't mean they are correct. so changes to the templates should be done with caution.
if in doubt, use graphCompiler to generate the shader and check the result.
in the end we should fix the issue and run the command again until it passes.
