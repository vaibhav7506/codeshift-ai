using System;
using System.IO;

namespace System.Web.Mvc
{
    public abstract class Controller { }
    public sealed class RoutePrefixAttribute : Attribute
    {
        public RoutePrefixAttribute(string template) => Template = template;
        public string Template { get; }
    }
    public sealed class RouteAttribute : Attribute
    {
        public RouteAttribute(string template) => Template = template;
        public string Template { get; }
    }
    public sealed class HttpGetAttribute : Attribute { }
    public sealed class AuthorizeAttribute : Attribute { }
}

namespace System.Data.Entity
{
    public abstract class DbContext { }
    public sealed class DbSet<TEntity> { }
}

namespace System.ServiceModel
{
    public sealed class ServiceContractAttribute : Attribute
    {
        public Type? CallbackContract { get; set; }
    }
    public sealed class OperationContractAttribute : Attribute { }
    public sealed class OperationBehaviorAttribute : Attribute
    {
        public bool TransactionScopeRequired { get; set; }
    }
}

namespace System.ServiceProcess
{
    public abstract class ServiceBase
    {
        protected virtual void OnStart(string[] args) { }
        protected virtual void OnStop() { }
    }
}

namespace SemanticFixture
{
    [System.Web.Mvc.RoutePrefix("api/users")]
    [System.Web.Mvc.Authorize]
    public sealed class UsersController : System.Web.Mvc.Controller
    {
        [System.Web.Mvc.HttpGet]
        [System.Web.Mvc.Route("{id}")]
        public string Get(int id) => id.ToString();
    }

    public sealed class LegacyDbContext : System.Data.Entity.DbContext
    {
        public System.Data.Entity.DbSet<User> Users { get; } = new();
    }

    public sealed class User { }

    [System.ServiceModel.ServiceContract]
    public interface IAccountService
    {
        [System.ServiceModel.OperationContract]
        [System.ServiceModel.OperationBehavior(TransactionScopeRequired = true)]
        Stream Download();
    }

    public sealed class LegacySyncService : System.ServiceProcess.ServiceBase
    {
        protected override void OnStart(string[] args) { }
        protected override void OnStop() { }
    }
}
